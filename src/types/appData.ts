import type { NutritionTargets, Product, RationEntry } from './product'

export type AppData = {
  products: Product[]
  rationEntries: RationEntry[]
  targets: NutritionTargets
}

export type SyncPhase = 'initializing' | 'guest' | 'loading' | 'saving' | 'synced' | 'error'

export type SyncState = {
  phase: SyncPhase
  message?: string
}
