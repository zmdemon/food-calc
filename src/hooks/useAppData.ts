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
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore'
import { defaultAppData } from '../data/defaultAppData'
import { auth, db, googleProvider } from '../lib/firebase'
import {
  getDeviceId,
  normalizeAppData,
  readConflictBackup,
  readGuestAppData,
  readUserAppData,
  writeConflictBackup,
  writeGuestAppData,
  writeUserAppData,
} from '../services/appDataStorage'
import { appDataEqual, decideSyncAction } from '../services/appDataSync'
import type {
  AppData,
  CloudDataVersion,
  ConflictBackup,
  LocalUserData,
  SyncConflict,
  SyncState,
} from '../types/appData'
import type { NutritionTargets, Product, RationEntry } from '../types/product'

const CLOUD_SCHEMA_VERSION = 2
const LOCAL_SAVE_DELAY_MS = 250
const CLOUD_SAVE_DELAY_MS = 900

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readCloudVersion = (value: unknown, fallback: AppData): CloudDataVersion => {
  const source = isRecord(value) ? value : {}
  const revision = typeof source.revision === 'number' && Number.isInteger(source.revision)
    ? Math.max(0, source.revision)
    : 0
  const updatedAt = source.updatedAt instanceof Timestamp ? source.updatedAt.toMillis() : null

  return {
    data: normalizeAppData(source, fallback),
    revision,
    updatedAt,
    updatedBy: typeof source.updatedBy === 'string' ? source.updatedBy : null,
  }
}

class RevisionConflictError extends Error {
  cloud: CloudDataVersion

  constructor(cloud: CloudDataVersion) {
    super('Cloud revision changed')
    this.cloud = cloud
  }
}

type AppDataController = AppData & {
  user: User | null
  authReady: boolean
  dataReady: boolean
  syncState: SyncState
  conflict: SyncConflict | null
  conflictBackup: ConflictBackup | null
  setProducts: Dispatch<SetStateAction<Product[]>>
  setRationEntries: Dispatch<SetStateAction<RationEntry[]>>
  setTargets: Dispatch<SetStateAction<NutritionTargets>>
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  syncNow: () => Promise<void>
  keepLocalVersion: () => Promise<void>
  keepCloudVersion: () => Promise<void>
}

export function useAppData(): AppDataController {
  const [data, setData] = useState<AppData>(() => readGuestAppData())
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [authReady, setAuthReady] = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>({ phase: 'initializing' })
  const [conflict, setConflict] = useState<SyncConflict | null>(null)
  const [conflictBackup, setConflictBackup] = useState<ConflictBackup | null>(null)

  const dataRef = useRef(data)
  const userRef = useRef<User | null>(auth.currentUser)
  const activeUidRef = useRef<string | null>(auth.currentUser?.uid ?? null)
  const localRecordRef = useRef<LocalUserData | null>(null)
  const cloudVersionRef = useRef<CloudDataVersion | null>(null)
  const cloudDocumentRef = useRef<DocumentReference | null>(null)
  const cloudReadyRef = useRef(false)
  const conflictRef = useRef<SyncConflict | null>(null)
  const syncInFlightRef = useRef(false)
  const authGenerationRef = useRef(0)
  const localSaveTimerRef = useRef<number | null>(null)
  const cloudSaveTimerRef = useRef<number | null>(null)
  const guestSaveTimerRef = useRef<number | null>(null)
  const performSyncRef = useRef<() => Promise<void>>(async () => undefined)
  const syncClientIdRef = useRef(`${getDeviceId()}:${crypto.randomUUID()}`)

  const applyData = useCallback((nextData: AppData) => {
    dataRef.current = nextData
    setData(nextData)
    setDataReady(true)
  }, [])

  const clearTimers = useCallback(() => {
    if (localSaveTimerRef.current !== null) window.clearTimeout(localSaveTimerRef.current)
    if (cloudSaveTimerRef.current !== null) window.clearTimeout(cloudSaveTimerRef.current)
    if (guestSaveTimerRef.current !== null) window.clearTimeout(guestSaveTimerRef.current)
    localSaveTimerRef.current = null
    cloudSaveTimerRef.current = null
    guestSaveTimerRef.current = null
  }, [])

  const persistUserSoon = useCallback((uid: string, record: LocalUserData) => {
    if (localSaveTimerRef.current !== null) window.clearTimeout(localSaveTimerRef.current)
    localSaveTimerRef.current = window.setTimeout(() => {
      if (activeUidRef.current === uid) writeUserAppData(uid, record)
      localSaveTimerRef.current = null
    }, LOCAL_SAVE_DELAY_MS)
  }, [])

  const scheduleCloudSync = useCallback((delay = CLOUD_SAVE_DELAY_MS) => {
    if (cloudSaveTimerRef.current !== null) window.clearTimeout(cloudSaveTimerRef.current)
    cloudSaveTimerRef.current = window.setTimeout(() => {
      cloudSaveTimerRef.current = null
      void performSyncRef.current()
    }, delay)
  }, [])

  const acceptCloudVersion = useCallback((cloud: CloudDataVersion) => {
    const uid = activeUidRef.current
    if (!uid) return

    const current = localRecordRef.current
    const syncedAt = cloud.updatedAt ?? Date.now()
    const nextRecord: LocalUserData = {
      data: cloud.data,
      baseRevision: cloud.revision,
      localRevision: current?.localRevision ?? 0,
      dirty: false,
      localUpdatedAt: syncedAt,
      lastSyncedAt: syncedAt,
      deviceId: current?.deviceId ?? getDeviceId(),
    }

    localRecordRef.current = nextRecord
    cloudVersionRef.current = cloud
    conflictRef.current = null
    setConflict(null)
    writeUserAppData(uid, nextRecord)
    applyData(cloud.data)
    setSyncState({ phase: 'synced', lastSyncedAt: syncedAt })
  }, [applyData])

  const showConflict = useCallback((local: LocalUserData, cloud: CloudDataVersion) => {
    if (appDataEqual(local.data, cloud.data)) {
      acceptCloudVersion(cloud)
      return
    }

    const nextConflict = { local: { ...local }, cloud }
    conflictRef.current = nextConflict
    setConflict(nextConflict)
    setSyncState({
      phase: 'conflict',
      message: 'Требуется подтверждение версии данных',
      lastSyncedAt: local.lastSyncedAt ?? undefined,
    })
  }, [acceptCloudVersion])

  const reconcileCloudVersion = useCallback((cloud: CloudDataVersion) => {
    cloudVersionRef.current = cloud
    const local = localRecordRef.current
    if (!local) {
      acceptCloudVersion(cloud)
      return
    }

    if (
      local.dirty
      && cloud.updatedBy === syncClientIdRef.current
      && cloud.revision === local.baseRevision + 1
    ) {
      const stillDirty = !appDataEqual(local.data, cloud.data)
      const nextRecord = {
        ...local,
        baseRevision: cloud.revision,
        dirty: stillDirty,
        lastSyncedAt: cloud.updatedAt ?? Date.now(),
      }
      const uid = activeUidRef.current
      localRecordRef.current = nextRecord
      if (uid) writeUserAppData(uid, nextRecord)

      if (stillDirty) {
        setSyncState({ phase: 'local-changes', lastSyncedAt: nextRecord.lastSyncedAt ?? undefined })
        scheduleCloudSync()
      } else {
        setSyncState({ phase: 'synced', lastSyncedAt: nextRecord.lastSyncedAt ?? undefined })
      }
      return
    }

    if (appDataEqual(local.data, cloud.data)) {
      acceptCloudVersion(cloud)
      return
    }

    const decision = decideSyncAction(local, cloud.revision)
    if (decision === 'download' || decision === 'synchronized') {
      acceptCloudVersion(cloud)
    } else if (decision === 'upload') {
      setSyncState({ phase: 'local-changes', lastSyncedAt: local.lastSyncedAt ?? undefined })
      scheduleCloudSync()
    } else {
      showConflict(local, cloud)
    }
  }, [acceptCloudVersion, scheduleCloudSync, showConflict])

  const performSync = useCallback(async () => {
    const currentUser = userRef.current
    const stateDocument = cloudDocumentRef.current
    const local = localRecordRef.current

    if (!currentUser || !stateDocument || !cloudReadyRef.current || !local) return
    if (conflictRef.current) {
      setSyncState({
        phase: 'conflict',
        message: 'Требуется подтверждение версии данных',
        lastSyncedAt: local.lastSyncedAt ?? undefined,
      })
      return
    }
    if (syncInFlightRef.current) return

    if (!local.dirty) {
      setSyncState({ phase: 'synced', lastSyncedAt: local.lastSyncedAt ?? undefined })
      return
    }

    if (!navigator.onLine) {
      setSyncState({
        phase: 'offline',
        message: 'Нет подключения — изменения сохранены на устройстве',
        lastSyncedAt: local.lastSyncedAt ?? undefined,
      })
      return
    }

    syncInFlightRef.current = true
    const uploaded = local
    const generation = authGenerationRef.current
    setSyncState({ phase: 'saving', lastSyncedAt: local.lastSyncedAt ?? undefined })

    try {
      const newRevision = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(stateDocument)
        const cloud = snapshot.exists()
          ? readCloudVersion(snapshot.data(), uploaded.data)
          : { data: uploaded.data, revision: 0, updatedAt: null, updatedBy: null }

        if (cloud.revision !== uploaded.baseRevision) throw new RevisionConflictError(cloud)

        const revision = cloud.revision + 1
        transaction.set(stateDocument, {
          ...uploaded.data,
          schemaVersion: CLOUD_SCHEMA_VERSION,
          revision,
          updatedAt: serverTimestamp(),
          updatedBy: syncClientIdRef.current,
        })
        return revision
      })

      if (generation !== authGenerationRef.current || activeUidRef.current !== currentUser.uid) return

      const current = localRecordRef.current
      if (!current) return
      const syncedAt = Date.now()
      const hasNewerLocalChanges = current.localRevision !== uploaded.localRevision
      const nextRecord: LocalUserData = {
        ...current,
        baseRevision: newRevision,
        dirty: hasNewerLocalChanges,
        lastSyncedAt: syncedAt,
      }

      localRecordRef.current = nextRecord
      cloudVersionRef.current = {
        data: uploaded.data,
        revision: newRevision,
        updatedAt: syncedAt,
        updatedBy: syncClientIdRef.current,
      }
      writeUserAppData(currentUser.uid, nextRecord)

      if (hasNewerLocalChanges) {
        setSyncState({ phase: 'local-changes', lastSyncedAt: syncedAt })
        scheduleCloudSync()
      } else {
        setSyncState({ phase: 'synced', lastSyncedAt: syncedAt })
      }
    } catch (error) {
      if (generation !== authGenerationRef.current || activeUidRef.current !== currentUser.uid) return
      const latestLocal = localRecordRef.current
      if (error instanceof RevisionConflictError && latestLocal) {
        showConflict(latestLocal, error.cloud)
      } else {
        setSyncState({
          phase: navigator.onLine ? 'error' : 'offline',
          message: navigator.onLine
            ? 'Не удалось синхронизировать изменения'
            : 'Нет подключения — изменения сохранены на устройстве',
          lastSyncedAt: latestLocal?.lastSyncedAt ?? undefined,
        })
      }
    } finally {
      syncInFlightRef.current = false
    }
  }, [scheduleCloudSync, showConflict])

  performSyncRef.current = performSync

  useEffect(() => {
    let documentUnsubscribe: Unsubscribe | undefined

    const authUnsubscribe = onAuthStateChanged(auth, (nextUser) => {
      authGenerationRef.current += 1
      const generation = authGenerationRef.current
      documentUnsubscribe?.()
      documentUnsubscribe = undefined
      clearTimers()
      syncInFlightRef.current = false
      cloudReadyRef.current = false
      cloudDocumentRef.current = null
      cloudVersionRef.current = null
      conflictRef.current = null
      setConflict(null)
      setDataReady(false)
      userRef.current = nextUser
      activeUidRef.current = nextUser?.uid ?? null
      setUser(nextUser)

      if (!nextUser) {
        localRecordRef.current = null
        setConflictBackup(null)
        const guestData = readGuestAppData()
        applyData(guestData)
        setAuthReady(true)
        setSyncState({ phase: 'guest' })
        return
      }

      const stateDocument = doc(db, 'users', nextUser.uid, 'state', 'current')
      const storedLocal = readUserAppData(nextUser.uid)
      const guestData = readGuestAppData()
      cloudDocumentRef.current = stateDocument
      localRecordRef.current = storedLocal
      setConflictBackup(readConflictBackup(nextUser.uid))
      setAuthReady(true)
      setSyncState({ phase: 'loading', lastSyncedAt: storedLocal?.lastSyncedAt ?? undefined })
      if (storedLocal) applyData(storedLocal.data)

      const subscribeToCloud = () => {
        if (generation !== authGenerationRef.current) return
        documentUnsubscribe = onSnapshot(
          stateDocument,
          { includeMetadataChanges: true },
          (snapshot) => {
            if (generation !== authGenerationRef.current || snapshot.metadata.hasPendingWrites) return
            cloudReadyRef.current = true

            if (!snapshot.exists()) {
              const current = localRecordRef.current
              if (!current) return
              const nextRecord = { ...current, baseRevision: 0, dirty: true }
              localRecordRef.current = nextRecord
              writeUserAppData(nextUser.uid, nextRecord)
              setSyncState({ phase: 'local-changes', lastSyncedAt: current.lastSyncedAt ?? undefined })
              scheduleCloudSync()
              return
            }

            reconcileCloudVersion(readCloudVersion(snapshot.data(), dataRef.current))
          },
          () => {
            const current = localRecordRef.current
            setSyncState({
              phase: navigator.onLine ? 'error' : 'offline',
              message: navigator.onLine
                ? 'Не удалось получить облачные данные'
                : 'Нет подключения — используются данные устройства',
              lastSyncedAt: current?.lastSyncedAt ?? undefined,
            })
          },
        )
      }

      void (async () => {
        try {
          const snapshot = await getDoc(stateDocument)
          if (generation !== authGenerationRef.current) return
          cloudReadyRef.current = true

          if (!snapshot.exists()) {
            const initialData = storedLocal?.data ?? guestData
            const nextRecord: LocalUserData = {
              data: initialData,
              baseRevision: 0,
              localRevision: (storedLocal?.localRevision ?? 0) + 1,
              dirty: true,
              localUpdatedAt: storedLocal?.localUpdatedAt ?? Date.now(),
              lastSyncedAt: storedLocal?.lastSyncedAt ?? null,
              deviceId: storedLocal?.deviceId ?? getDeviceId(),
            }
            localRecordRef.current = nextRecord
            writeUserAppData(nextUser.uid, nextRecord)
            applyData(initialData)
            setSyncState({ phase: 'local-changes', lastSyncedAt: nextRecord.lastSyncedAt ?? undefined })
            scheduleCloudSync()
          } else {
            const cloud = readCloudVersion(snapshot.data(), storedLocal?.data ?? guestData)
            cloudVersionRef.current = cloud

            if (storedLocal) {
              reconcileCloudVersion(cloud)
            } else if (!appDataEqual(guestData, defaultAppData) && !appDataEqual(guestData, cloud.data)) {
              const localCandidate: LocalUserData = {
                data: guestData,
                baseRevision: cloud.revision,
                localRevision: 1,
                dirty: true,
                localUpdatedAt: Date.now(),
                lastSyncedAt: null,
                deviceId: getDeviceId(),
              }
              localRecordRef.current = localCandidate
              writeUserAppData(nextUser.uid, localCandidate)
              applyData(guestData)
              showConflict(localCandidate, cloud)
            } else {
              acceptCloudVersion(cloud)
            }
          }
        } catch {
          if (generation !== authGenerationRef.current) return
          const fallbackRecord: LocalUserData = storedLocal ?? {
            data: guestData,
            baseRevision: 0,
            localRevision: 1,
            dirty: true,
            localUpdatedAt: Date.now(),
            lastSyncedAt: null,
            deviceId: getDeviceId(),
          }
          localRecordRef.current = fallbackRecord
          writeUserAppData(nextUser.uid, fallbackRecord)
          applyData(fallbackRecord.data)
          setSyncState({
            phase: navigator.onLine ? 'error' : 'offline',
            message: navigator.onLine
              ? 'Не удалось проверить данные в облаке'
              : 'Нет подключения — используются данные устройства',
            lastSyncedAt: fallbackRecord.lastSyncedAt ?? undefined,
          })
        } finally {
          subscribeToCloud()
        }
      })()
    })

    return () => {
      authGenerationRef.current += 1
      clearTimers()
      documentUnsubscribe?.()
      authUnsubscribe()
    }
  }, [
    acceptCloudVersion,
    applyData,
    clearTimers,
    reconcileCloudVersion,
    scheduleCloudSync,
    showConflict,
  ])

  useEffect(() => {
    const handleOnline = () => {
      const local = localRecordRef.current
      if (userRef.current && local && !conflictRef.current) scheduleCloudSync(0)
    }
    const handleOffline = () => {
      const local = localRecordRef.current
      if (userRef.current) {
        setSyncState({
          phase: 'offline',
          message: local?.dirty
            ? 'Нет подключения — изменения сохранены на устройстве'
            : 'Нет подключения — используются данные устройства',
          lastSyncedAt: local?.lastSyncedAt ?? undefined,
        })
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [scheduleCloudSync])

  useEffect(() => {
    const flushLocalData = () => {
      const currentUser = userRef.current
      const local = localRecordRef.current
      if (currentUser && local) writeUserAppData(currentUser.uid, local)
      else writeGuestAppData(dataRef.current)
    }

    window.addEventListener('pagehide', flushLocalData)
    return () => window.removeEventListener('pagehide', flushLocalData)
  }, [])

  const updateField = useCallback(<K extends keyof AppData>(
    field: K,
    value: SetStateAction<AppData[K]>,
  ) => {
    const current = dataRef.current
    const nextValue = typeof value === 'function'
      ? (value as (previous: AppData[K]) => AppData[K])(current[field])
      : value
    const nextData = { ...current, [field]: nextValue }
    applyData(nextData)

    const currentUser = userRef.current
    if (!currentUser) {
      if (guestSaveTimerRef.current !== null) window.clearTimeout(guestSaveTimerRef.current)
      guestSaveTimerRef.current = window.setTimeout(() => {
        writeGuestAppData(nextData)
        guestSaveTimerRef.current = null
      }, LOCAL_SAVE_DELAY_MS)
      return
    }

    const currentRecord = localRecordRef.current
    const nextRecord: LocalUserData = {
      data: nextData,
      baseRevision: currentRecord?.baseRevision ?? cloudVersionRef.current?.revision ?? 0,
      localRevision: (currentRecord?.localRevision ?? 0) + 1,
      dirty: true,
      localUpdatedAt: Date.now(),
      lastSyncedAt: currentRecord?.lastSyncedAt ?? null,
      deviceId: currentRecord?.deviceId ?? getDeviceId(),
    }
    localRecordRef.current = nextRecord
    persistUserSoon(currentUser.uid, nextRecord)

    if (conflictRef.current) {
      const nextConflict = { ...conflictRef.current, local: nextRecord }
      conflictRef.current = nextConflict
      setConflict(nextConflict)
      setSyncState({
        phase: 'conflict',
        message: 'Требуется подтверждение версии данных',
        lastSyncedAt: nextRecord.lastSyncedAt ?? undefined,
      })
    } else {
      setSyncState({ phase: 'local-changes', lastSyncedAt: nextRecord.lastSyncedAt ?? undefined })
      scheduleCloudSync()
    }
  }, [applyData, persistUserSoon, scheduleCloudSync])

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

  const syncNow = useCallback(async () => {
    const stateDocument = cloudDocumentRef.current
    const local = localRecordRef.current
    if (!stateDocument || !local || !userRef.current) return
    if (conflictRef.current) {
      setSyncState({
        phase: 'conflict',
        message: 'Требуется подтверждение версии данных',
        lastSyncedAt: local.lastSyncedAt ?? undefined,
      })
      return
    }
    if (local.dirty) {
      await performSyncRef.current()
      return
    }

    setSyncState({ phase: 'loading', lastSyncedAt: local.lastSyncedAt ?? undefined })
    try {
      const snapshot = await getDoc(stateDocument)
      if (snapshot.exists()) reconcileCloudVersion(readCloudVersion(snapshot.data(), local.data))
      else {
        const nextRecord = { ...local, baseRevision: 0, dirty: true }
        localRecordRef.current = nextRecord
        writeUserAppData(userRef.current.uid, nextRecord)
        setSyncState({ phase: 'local-changes', lastSyncedAt: local.lastSyncedAt ?? undefined })
        scheduleCloudSync(0)
      }
    } catch {
      setSyncState({
        phase: navigator.onLine ? 'error' : 'offline',
        message: navigator.onLine
          ? 'Не удалось проверить данные в облаке'
          : 'Нет подключения — используются данные устройства',
        lastSyncedAt: local.lastSyncedAt ?? undefined,
      })
    }
  }, [reconcileCloudVersion, scheduleCloudSync])

  const keepLocalVersion = useCallback(async () => {
    const currentConflict = conflictRef.current
    const currentUser = userRef.current
    const local = localRecordRef.current
    if (!currentConflict || !currentUser || !local) return

    const backup: ConflictBackup = {
      data: currentConflict.cloud.data,
      source: 'cloud',
      createdAt: Date.now(),
    }
    writeConflictBackup(currentUser.uid, backup)
    setConflictBackup(backup)

    const nextRecord = {
      ...local,
      baseRevision: currentConflict.cloud.revision,
      dirty: true,
    }
    localRecordRef.current = nextRecord
    writeUserAppData(currentUser.uid, nextRecord)
    conflictRef.current = null
    setConflict(null)
    setSyncState({ phase: 'local-changes', lastSyncedAt: nextRecord.lastSyncedAt ?? undefined })
    await performSyncRef.current()
  }, [])

  const keepCloudVersion = useCallback(async () => {
    const currentConflict = conflictRef.current
    const currentUser = userRef.current
    const stateDocument = cloudDocumentRef.current
    const local = localRecordRef.current
    if (!currentConflict || !currentUser || !stateDocument || !local) return

    const backup: ConflictBackup = {
      data: local.data,
      source: 'local',
      createdAt: Date.now(),
    }
    writeConflictBackup(currentUser.uid, backup)
    setConflictBackup(backup)
    setSyncState({ phase: 'loading', message: 'Загрузка актуальной облачной версии…' })

    try {
      const snapshot = await getDoc(stateDocument)
      if (!snapshot.exists()) {
        showConflict(local, currentConflict.cloud)
        return
      }
      acceptCloudVersion(readCloudVersion(snapshot.data(), currentConflict.cloud.data))
    } catch (error) {
      setSyncState({
        phase: 'conflict',
        message: navigator.onLine
          ? 'Не удалось загрузить облачную версию — выберите действие повторно'
          : 'Нет подключения — выбор версии отложен',
        lastSyncedAt: local.lastSyncedAt ?? undefined,
      })
      throw error
    }
  }, [acceptCloudVersion, showConflict])

  const signIn = useCallback(async () => {
    writeGuestAppData(dataRef.current)
    await signInWithPopup(auth, googleProvider)
  }, [])

  const signOut = useCallback(async () => {
    const currentUser = userRef.current
    const local = localRecordRef.current
    if (currentUser && local) writeUserAppData(currentUser.uid, local)
    if (currentUser && local?.dirty && !conflictRef.current && navigator.onLine) {
      try {
        await performSyncRef.current()
      } catch {
        // Локальная пользовательская копия уже сохранена, поэтому выход можно продолжить.
      }
    }
    await firebaseSignOut(auth)
  }, [])

  return {
    ...data,
    user,
    authReady,
    dataReady,
    syncState,
    conflict,
    conflictBackup,
    setProducts,
    setRationEntries,
    setTargets,
    signIn,
    signOut,
    syncNow,
    keepLocalVersion,
    keepCloudVersion,
  }
}
