import type { NutritionTargets, Product, RationEntry } from './product'

export type AppData = {
  products: Product[]
  rationEntries: RationEntry[]
  targets: NutritionTargets
}

export type LocalUserData = {
  data: AppData
  baseRevision: number
  localRevision: number
  dirty: boolean
  localUpdatedAt: number
  lastSyncedAt: number | null
  deviceId: string
}

export type CloudDataVersion = {
  data: AppData
  revision: number
  updatedAt: number | null
  updatedBy: string | null
}

export type SyncConflict = {
  local: LocalUserData
  cloud: CloudDataVersion
}

export type ConflictBackup = {
  data: AppData
  source: 'local' | 'cloud'
  createdAt: number
}

export type SyncPhase =
  | 'initializing'
  | 'guest'
  | 'loading'
  | 'local-changes'
  | 'saving'
  | 'synced'
  | 'conflict'
  | 'offline'
  | 'error'

export type SyncState = {
  phase: SyncPhase
  message?: string
  lastSyncedAt?: number
}
