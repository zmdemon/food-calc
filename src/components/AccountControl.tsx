import { useState } from 'react'
import type { User } from 'firebase/auth'
import type { SyncState } from '../types/appData'

type AccountControlProps = {
  user: User | null
  authReady: boolean
  syncState: SyncState
  onSignIn: () => Promise<void>
  onSignOut: () => Promise<void>
}

const syncLabels: Record<SyncState['phase'], string> = {
  initializing: 'Подключение…',
  guest: 'Данные на устройстве',
  loading: 'Загрузка данных…',
  'local-changes': 'Есть локальные изменения',
  saving: 'Синхронизация…',
  synced: 'Синхронизировано',
  conflict: 'Требуется подтверждение',
  offline: 'Нет подключения',
  error: 'Ошибка синхронизации',
}

export function AccountControl({ user, authReady, syncState, onSignIn, onSignOut }: AccountControlProps) {
  const [actionError, setActionError] = useState('')
  const [actionPending, setActionPending] = useState(false)

  const runAction = async (action: () => Promise<void>, errorMessage: string) => {
    setActionError('')
    setActionPending(true)
    try {
      await action()
    } catch {
      setActionError(errorMessage)
    } finally {
      setActionPending(false)
    }
  }

  if (!authReady || !user) {
    return (
      <div className="auth-control">
        <button
          className="button button--ghost google-button"
          type="button"
          disabled={!authReady || actionPending}
          onClick={() => void runAction(onSignIn, 'Не удалось войти через Google. Попробуйте ещё раз.')}
        >
          <span className="google-button__mark">G</span>
          <span>{actionPending ? 'Входим…' : 'Войти через Google'}</span>
        </button>
        {actionError && <div className="auth-control__error" role="alert">{actionError}</div>}
      </div>
    )
  }

  const displayName = user.displayName || user.email || 'Аккаунт'
  const initial = displayName.slice(0, 1).toLocaleUpperCase('ru')

  return (
    <details className="account-menu">
      <summary aria-label="Открыть меню аккаунта">
        {user.photoURL
          ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          : <span className="account-menu__avatar">{initial}</span>}
        <div>
          <strong>{displayName}</strong>
          <small className={`sync-status sync-status--${syncState.phase}`}>
            {syncState.message || syncLabels[syncState.phase]}
          </small>
        </div>
      </summary>
      <div className="account-menu__popover">
        <strong>{displayName}</strong>
        {user.email && <span>{user.email}</span>}
        <div className={`account-menu__sync sync-status--${syncState.phase}`}>
          {syncState.message || syncLabels[syncState.phase]}
        </div>
        {actionError && <div className="account-menu__error" role="alert">{actionError}</div>}
        <button
          type="button"
          disabled={actionPending}
          onClick={() => void runAction(onSignOut, 'Не удалось выйти из аккаунта.')}
        >
          {actionPending ? 'Выходим…' : 'Выйти из аккаунта'}
        </button>
      </div>
    </details>
  )
}
