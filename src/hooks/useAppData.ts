import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase'
import { normalizeAppData, readGuestAppData, writeGuestAppData } from '../services/appDataStorage'
import type { AppData, SyncState } from '../types/appData'
import type { NutritionTargets, Product, RationEntry } from '../types/product'

const CLOUD_SCHEMA_VERSION = 1
const SAVE_DELAY_MS = 600

const serializeData = (data: AppData) => JSON.stringify(data)

type AppDataController = AppData & {
  user: User | null
  authReady: boolean
  syncState: SyncState
  setProducts: Dispatch<SetStateAction<Product[]>>
  setRationEntries: Dispatch<SetStateAction<RationEntry[]>>
  setTargets: Dispatch<SetStateAction<NutritionTargets>>
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

export function useAppData(): AppDataController {
  const [data, setData] = useState<AppData>(() => readGuestAppData())
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [authReady, setAuthReady] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>({ phase: 'initializing' })

  const dataRef = useRef(data)
  const cloudDocumentRef = useRef<DocumentReference | null>(null)
  const cloudReadyRef = useRef(false)
  const lastCloudValueRef = useRef('')
  const hasUnsavedChangesRef = useRef(false)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    let documentUnsubscribe: Unsubscribe | undefined
    let authGeneration = 0

    const authUnsubscribe = onAuthStateChanged(auth, (nextUser) => {
      authGeneration += 1
      const currentGeneration = authGeneration
      documentUnsubscribe?.()
      documentUnsubscribe = undefined
      cloudReadyRef.current = false
      cloudDocumentRef.current = null
      hasUnsavedChangesRef.current = false
      setUser(nextUser)

      if (!nextUser) {
        const guestData = readGuestAppData()
        dataRef.current = guestData
        setData(guestData)
        setAuthReady(true)
        setSyncState({ phase: 'guest' })
        return
      }

      setAuthReady(true)
      setSyncState({ phase: 'loading' })

      void (async () => {
        try {
          const stateDocument = doc(db, 'users', nextUser.uid, 'state', 'current')
          const snapshot = await getDoc(stateDocument)
          if (currentGeneration !== authGeneration) return

          let initialData: AppData
          if (snapshot.exists()) {
            initialData = normalizeAppData(snapshot.data(), readGuestAppData())
          } else {
            initialData = readGuestAppData()
            await setDoc(stateDocument, {
              ...initialData,
              schemaVersion: CLOUD_SCHEMA_VERSION,
              updatedAt: serverTimestamp(),
            })
            if (currentGeneration !== authGeneration) return
          }

          const serialized = serializeData(initialData)
          cloudDocumentRef.current = stateDocument
          cloudReadyRef.current = true
          lastCloudValueRef.current = serialized
          dataRef.current = initialData
          setData(initialData)
          setSyncState({ phase: 'synced' })

          documentUnsubscribe = onSnapshot(
            stateDocument,
            { includeMetadataChanges: true },
            (cloudSnapshot) => {
              if (!cloudSnapshot.exists() || cloudSnapshot.metadata.hasPendingWrites) return
              const incomingData = normalizeAppData(cloudSnapshot.data(), dataRef.current)
              const incomingSerialized = serializeData(incomingData)
              const currentSerialized = serializeData(dataRef.current)

              if (hasUnsavedChangesRef.current && incomingSerialized !== currentSerialized) return

              lastCloudValueRef.current = incomingSerialized
              hasUnsavedChangesRef.current = false

              if (incomingSerialized !== currentSerialized) {
                dataRef.current = incomingData
                setData(incomingData)
              }
              setSyncState({ phase: 'synced' })
            },
            () => setSyncState({ phase: 'error', message: 'Не удалось получить облачные данные' }),
          )
        } catch {
          if (currentGeneration !== authGeneration) return
          setSyncState({ phase: 'error', message: 'Не удалось загрузить данные из облака' })
        }
      })()
    })

    return () => {
      authGeneration += 1
      documentUnsubscribe?.()
      authUnsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!authReady) return

    if (!user) {
      writeGuestAppData(data)
      return
    }

    if (!cloudReadyRef.current || !cloudDocumentRef.current) return
    const serialized = serializeData(data)
    if (serialized === lastCloudValueRef.current) return

    setSyncState({ phase: 'saving' })
    const timeout = window.setTimeout(() => {
      const stateDocument = cloudDocumentRef.current
      if (!stateDocument) return

      void setDoc(stateDocument, {
        ...data,
        schemaVersion: CLOUD_SCHEMA_VERSION,
        updatedAt: serverTimestamp(),
      }).then(() => {
        lastCloudValueRef.current = serialized
        if (serializeData(dataRef.current) === serialized) {
          hasUnsavedChangesRef.current = false
          setSyncState({ phase: 'synced' })
        }
      }).catch(() => {
        setSyncState({ phase: 'error', message: 'Не удалось сохранить изменения' })
      })
    }, SAVE_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [authReady, data, user])

  const updateField = useCallback(<K extends keyof AppData>(
    field: K,
    value: SetStateAction<AppData[K]>,
  ) => {
    if (user) hasUnsavedChangesRef.current = true
    setData((current) => ({
      ...current,
      [field]: typeof value === 'function'
        ? (value as (previous: AppData[K]) => AppData[K])(current[field])
        : value,
    }))
  }, [user])

  const setProducts = useCallback<Dispatch<SetStateAction<Product[]>>>(
    (value) => updateField('products', value),
    [updateField],
  )
  const setRationEntries = useCallback<Dispatch<SetStateAction<RationEntry[]>>>(
    (value) => updateField('rationEntries', value),
    [updateField],
  )
  const setTargets = useCallback<Dispatch<SetStateAction<NutritionTargets>>>(
    (value) => updateField('targets', value),
    [updateField],
  )

  const signIn = useCallback(async () => {
    await signInWithPopup(auth, googleProvider)
  }, [])

  const signOut = useCallback(async () => {
    if (cloudReadyRef.current && cloudDocumentRef.current) {
      try {
        await setDoc(cloudDocumentRef.current, {
          ...dataRef.current,
          schemaVersion: CLOUD_SCHEMA_VERSION,
          updatedAt: serverTimestamp(),
        })
        lastCloudValueRef.current = serializeData(dataRef.current)
      } catch {
        // Выход не должен блокироваться из-за временной ошибки сети.
      }
    }
    await firebaseSignOut(auth)
  }, [])

  return {
    ...data,
    user,
    authReady,
    syncState,
    setProducts,
    setRationEntries,
    setTargets,
    signIn,
    signOut,
  }
}
