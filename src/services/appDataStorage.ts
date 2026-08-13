import { defaultAppData } from '../data/defaultAppData'
import { defaultAmounts } from '../data/defaultProducts'
import type { AppData, ConflictBackup, LocalUserData, RationTab } from '../types/appData'
import type { NutritionTargets, Product, RationAmounts, RationEntry } from '../types/product'

const GUEST_KEYS = {
  products: 'food-calc.products.v1',
  rationTabs: 'food-calc.ration-tabs.v1',
  rationEntries: 'food-calc.ration-entries.v1',
  targets: 'food-calc.targets.v1',
  legacyAmounts: 'food-calc.amounts.v1',
  legacyHiddenProducts: 'food-calc.hidden-products.v1',
  legacyOrder: 'food-calc.ration-order.v1',
} as const

const DEVICE_ID_KEY = 'food-calc.device-id.v1'
const userDataKey = (uid: string) => `food-calc.user.${uid}.v2`
const conflictBackupKey = (uid: string) => `food-calc.conflict-backup.${uid}.v1`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? (JSON.parse(stored) as T) : fallback
  } catch {
    return fallback
  }
}

const finiteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0

const normalizeProduct = (value: unknown): Product | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null

  return {
    id: value.id,
    name: value.name,
    protein: finiteNumber(value.protein),
    fat: finiteNumber(value.fat),
    carbs: finiteNumber(value.carbs),
    fiber: finiteNumber(value.fiber),
    calories: finiteNumber(value.calories),
    packagePrice: finiteNumber(value.packagePrice),
    packageWeight: finiteNumber(value.packageWeight),
  }
}

const normalizeRationEntry = (value: unknown): RationEntry | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.productId !== 'string') return null
  return {
    id: value.id,
    productId: value.productId,
    amount: finiteNumber(value.amount),
    enabled: value.enabled !== false,
  }
}

const normalizeRationTabs = (value: unknown): RationTab[] => {
  if (!Array.isArray(value)) return []

  const seenIds = new Set<string>()
  return value.flatMap<RationTab>((item, index) => {
    if (!isRecord(item) || typeof item.id !== 'string' || seenIds.has(item.id)) return []
    seenIds.add(item.id)

    const name = typeof item.name === 'string' && item.name.trim()
      ? item.name.trim().slice(0, 60)
      : `Набор ${index + 1}`
    const rationEntries = Array.isArray(item.rationEntries)
      ? item.rationEntries
        .map(normalizeRationEntry)
        .filter((entry): entry is RationEntry => entry !== null)
      : []

    return [{ id: item.id, name, rationEntries }]
  })
}

const normalizeTargets = (value: unknown): NutritionTargets => {
  const source = isRecord(value) ? value : {}
  return {
    protein: finiteNumber(source.protein),
    fat: finiteNumber(source.fat),
    carbs: finiteNumber(source.carbs),
    fiber: finiteNumber(source.fiber),
  }
}

const migrateLegacyRation = (products: Product[]): RationEntry[] => {
  const amounts = readJson<RationAmounts>(GUEST_KEYS.legacyAmounts, defaultAmounts)
  const hiddenProducts = readJson<Record<string, boolean>>(GUEST_KEYS.legacyHiddenProducts, {})
  const legacyOrder = readJson<string[]>(GUEST_KEYS.legacyOrder, [])
  const productIds = new Set(products.map((product) => product.id))
  const remainingProductIds = new Set(
    Object.keys(amounts).filter((productId) => productIds.has(productId)),
  )
  const orderedProductIds = [
    ...legacyOrder.filter((productId) => remainingProductIds.delete(productId)),
    ...remainingProductIds,
  ]

  return orderedProductIds.map((productId) => ({
    id: `legacy:${productId}`,
    productId,
    amount: finiteNumber(amounts[productId]),
    enabled: !hiddenProducts[productId],
  }))
}

export function normalizeAppData(value: unknown, fallback = defaultAppData): AppData {
  if (!isRecord(value)) return fallback

  const products = Array.isArray(value.products)
    ? value.products.map(normalizeProduct).filter((product): product is Product => product !== null)
    : fallback.products
  const legacyRationEntries = Array.isArray(value.rationEntries)
    ? value.rationEntries.map(normalizeRationEntry).filter((entry): entry is RationEntry => entry !== null)
    : Array.isArray(value.ration)
      ? value.ration.map(normalizeRationEntry).filter((entry): entry is RationEntry => entry !== null)
      : null
  const storedTabs = normalizeRationTabs(value.rationTabs)
  const rationTabs = storedTabs.length > 0
    ? storedTabs
    : legacyRationEntries
      ? [{ id: 'migrated-ration', name: 'Набор 1', rationEntries: legacyRationEntries }]
      : fallback.rationTabs

  return {
    products,
    rationTabs,
    targets: value.targets === undefined ? fallback.targets : normalizeTargets(value.targets),
  }
}

export function readGuestAppData(): AppData {
  const products = readJson<Product[]>(GUEST_KEYS.products, defaultAppData.products)
  const storedRationTabs = readJson<RationTab[] | null>(GUEST_KEYS.rationTabs, null)
  const storedRationEntries = readJson<RationEntry[] | null>(GUEST_KEYS.rationEntries, null)

  return normalizeAppData({
    products,
    rationTabs: storedRationTabs,
    rationEntries: storedRationTabs ? undefined : storedRationEntries ?? migrateLegacyRation(products),
    targets: readJson(GUEST_KEYS.targets, defaultAppData.targets),
  })
}

export function writeGuestAppData(data: AppData) {
  window.localStorage.setItem(GUEST_KEYS.products, JSON.stringify(data.products))
  window.localStorage.setItem(GUEST_KEYS.rationTabs, JSON.stringify(data.rationTabs))
  window.localStorage.setItem(GUEST_KEYS.targets, JSON.stringify(data.targets))
}

export function getDeviceId() {
  const existing = window.localStorage.getItem(DEVICE_ID_KEY)
  if (existing) return existing

  const deviceId = crypto.randomUUID()
  window.localStorage.setItem(DEVICE_ID_KEY, deviceId)
  return deviceId
}

export function readUserAppData(uid: string): LocalUserData | null {
  const stored = readJson<unknown>(userDataKey(uid), null)
  if (!isRecord(stored) || !isRecord(stored.data)) return null

  const baseRevision = typeof stored.baseRevision === 'number' && Number.isInteger(stored.baseRevision)
    ? Math.max(0, stored.baseRevision)
    : 0
  const localRevision = typeof stored.localRevision === 'number' && Number.isInteger(stored.localRevision)
    ? Math.max(0, stored.localRevision)
    : 0

  return {
    data: normalizeAppData(stored.data),
    baseRevision,
    localRevision,
    dirty: stored.dirty === true,
    localUpdatedAt: typeof stored.localUpdatedAt === 'number' ? stored.localUpdatedAt : Date.now(),
    lastSyncedAt: typeof stored.lastSyncedAt === 'number' ? stored.lastSyncedAt : null,
    deviceId: typeof stored.deviceId === 'string' && stored.deviceId
      ? stored.deviceId
      : getDeviceId(),
  }
}

export function writeUserAppData(uid: string, value: LocalUserData) {
  window.localStorage.setItem(userDataKey(uid), JSON.stringify(value))
}

export function readConflictBackup(uid: string): ConflictBackup | null {
  const stored = readJson<unknown>(conflictBackupKey(uid), null)
  if (!isRecord(stored) || !isRecord(stored.data)) return null
  if (stored.source !== 'local' && stored.source !== 'cloud') return null

  return {
    data: normalizeAppData(stored.data),
    source: stored.source,
    createdAt: typeof stored.createdAt === 'number' ? stored.createdAt : Date.now(),
  }
}

export function writeConflictBackup(uid: string, value: ConflictBackup) {
  window.localStorage.setItem(conflictBackupKey(uid), JSON.stringify(value))
}
