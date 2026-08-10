import type { LocalUserData } from '../types/appData'

export type SyncDecision = 'download' | 'upload' | 'synchronized' | 'conflict'

export function decideSyncAction(local: LocalUserData, cloudRevision: number): SyncDecision {
  if (local.dirty) {
    return cloudRevision === local.baseRevision ? 'upload' : 'conflict'
  }

  if (cloudRevision > local.baseRevision) return 'download'
  if (cloudRevision === local.baseRevision) return 'synchronized'
  return 'conflict'
}

export function appDataEqual(left: LocalUserData['data'], right: LocalUserData['data']) {
  return JSON.stringify(left) === JSON.stringify(right)
}
