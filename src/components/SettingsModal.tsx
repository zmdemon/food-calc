import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import type { ConflictBackup, SyncConflict, SyncState } from '../types/appData'
import { Icon } from './Icon'

type SettingsTab = 'data' | 'sync'

type SettingsModalProps = {
  user: User | null
  authReady: boolean
  syncState: SyncState
  conflict: SyncConflict | null
  conflictBackup: ConflictBackup | null
  onClose: () => void
  onOpenRationExport: () => void
  onExportBackup: () => void
  onDownloadConflictBackup: () => void
  onOpenConflict: () => void
  onSignIn: () => Promise<void>
  onSignOut: () => Promise<void>
  onSyncNow: () => Promise<void>
}

const syncLabels: Record<SyncState['phase'], string> = {
  initializing: 'Подключение…',
  guest: 'Данные на устройстве',
  loading: 'Проверка данных…',
  'local-changes': 'Есть локальные изменения',
  saving: 'Синхронизация…',
  synced: 'Синхронизировано',
  conflict: 'Требуется подтверждение',
  offline: 'Нет подключения',
  error: 'Ошибка синхронизации',
}

const formatDate = (value?: number) => value
  ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(value)
  : 'Синхронизация ещё не выполнялась'

export function SettingsModal({
  user,
  authReady,
  syncState,
  conflict,
  conflictBackup,
  onClose,
  onOpenRationExport,
  onExportBackup,
  onDownloadConflictBackup,
  onOpenConflict,
  onSignIn,
  onSignOut,
  onSyncNow,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('data')
  const [backupExported, setBackupExported] = useState(false)
  const [actionPending, setActionPending] = useState<'signin' | 'signout' | 'sync' | null>(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])

  const exportBackup = () => {
    onExportBackup()
    setBackupExported(true)
  }

  const runAction = async (name: 'signin' | 'signout' | 'sync', action: () => Promise<void>) => {
    setActionPending(name)
    setActionError('')
    try {
      await action()
    } catch {
      setActionError('Не удалось выполнить действие. Попробуйте ещё раз.')
    } finally {
      setActionPending(null)
    }
  }

  const displayName = user?.displayName || user?.email || 'Аккаунт Google'

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal__head settings-modal__head">
          <div>
            <span className="eyebrow">Приложение</span>
            <h2 id="settings-title">Настройки</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть настройки">
            <Icon name="close" size={21} />
          </button>
        </div>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Разделы настроек">
            <button
              className={`settings-nav__item${activeTab === 'data' ? ' settings-nav__item--active' : ''}`}
              type="button"
              aria-current={activeTab === 'data' ? 'page' : undefined}
              onClick={() => setActiveTab('data')}
            >
              <Icon name="database" size={18} />
              <span>Данные</span>
            </button>
            <button
              className={`settings-nav__item${activeTab === 'sync' ? ' settings-nav__item--active' : ''}`}
              type="button"
              aria-current={activeTab === 'sync' ? 'page' : undefined}
              onClick={() => setActiveTab('sync')}
            >
              <Icon name="cloud" size={18} />
              <span>Синхронизация</span>
              {conflict && <i className="settings-nav__badge" aria-label="Требуется подтверждение" />}
            </button>
          </nav>

          {activeTab === 'data' ? (
            <div className="settings-content">
              <div className="settings-content__head">
                <h3>Экспорт данных</h3>
                <p>Сохраните отчёт по текущему рациону или полную копию данных приложения.</p>
              </div>

              <div className="settings-export-list">
                <article className="settings-export-card">
                  <div className="settings-export-card__icon"><Icon name="file-text" size={21} /></div>
                  <div className="settings-export-card__body">
                    <strong>Отчёт по рациону</strong>
                    <p>Текущий набор продуктов, итоговые значения и цели в формате Markdown.</p>
                    <span>Формат: .md</span>
                  </div>
                  <button className="button button--ghost" type="button" onClick={onOpenRationExport}>
                    Открыть отчёт
                  </button>
                </article>

                <article className="settings-export-card">
                  <div className="settings-export-card__icon"><Icon name="download" size={21} /></div>
                  <div className="settings-export-card__body">
                    <strong>Резервная копия</strong>
                    <p>Каталог продуктов, рацион и цели одним файлом для сохранения данных.</p>
                    <span>Формат: .json</span>
                  </div>
                  <button className="button button--primary" type="button" onClick={exportBackup}>
                    Скачать копию
                  </button>
                </article>
              </div>

              <p className="settings-export-status" role="status" aria-live="polite">
                {backupExported ? 'Резервная копия скачана.' : ''}
              </p>
            </div>
          ) : (
            <div className="settings-content settings-sync">
              <div className="settings-content__head">
                <h3>Синхронизация</h3>
                <p>Локальная копия работает без интернета, а изменения безопасно переносятся между устройствами.</p>
              </div>

              {!authReady || !user ? (
                <article className="settings-sync__guest">
                  <div className="settings-sync__hero-icon"><Icon name="cloud" size={25} /></div>
                  <div>
                    <strong>Данные хранятся на этом устройстве</strong>
                    <p>Войдите через Google, чтобы создать облачную копию и синхронизировать изменения между устройствами.</p>
                  </div>
                  <button
                    className="button button--primary"
                    type="button"
                    disabled={!authReady || actionPending !== null}
                    onClick={() => void runAction('signin', onSignIn)}
                  >
                    {actionPending === 'signin' ? 'Входим…' : 'Войти через Google'}
                  </button>
                </article>
              ) : (
                <>
                  <article className="settings-sync__account">
                    {user.photoURL
                      ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
                      : <span>{displayName.slice(0, 1).toLocaleUpperCase('ru')}</span>}
                    <div>
                      <strong>{displayName}</strong>
                      {user.email && <small>{user.email}</small>}
                    </div>
                  </article>

                  <article className={`settings-sync__status settings-sync__status--${syncState.phase}`}>
                    <div className="settings-sync__status-icon"><Icon name="refresh" size={20} /></div>
                    <div>
                      <span>Состояние</span>
                      <strong>{syncState.message || syncLabels[syncState.phase]}</strong>
                      <small>Последняя успешная: {formatDate(syncState.lastSyncedAt)}</small>
                    </div>
                    <button
                      className="button button--ghost"
                      type="button"
                      disabled={actionPending !== null || syncState.phase === 'saving' || syncState.phase === 'loading' || Boolean(conflict)}
                      onClick={() => void runAction('sync', onSyncNow)}
                    >
                      {actionPending === 'sync' ? 'Проверка…' : 'Синхронизировать сейчас'}
                    </button>
                  </article>

                  {conflict && (
                    <article className="settings-sync__conflict">
                      <div>
                        <strong>Требуется выбрать версию данных</strong>
                        <p>Автоматическая синхронизация приостановлена, поэтому данные не будут перезаписаны без подтверждения.</p>
                      </div>
                      <button className="button button--primary" type="button" onClick={onOpenConflict}>
                        Разрешить конфликт
                      </button>
                    </article>
                  )}

                  {conflictBackup && (
                    <article className="settings-sync__backup">
                      <div>
                        <strong>Последняя сохранённая версия</strong>
                        <p>
                          Резервная копия {conflictBackup.source === 'local' ? 'с устройства' : 'из облака'} создана{' '}
                          {formatDate(conflictBackup.createdAt)}.
                        </p>
                      </div>
                      <button className="button button--ghost" type="button" onClick={onDownloadConflictBackup}>
                        Скачать
                      </button>
                    </article>
                  )}

                  <div className="settings-sync__footer">
                    <span>При выходе локальная копия аккаунта сохранится на устройстве.</span>
                    <button
                      type="button"
                      disabled={actionPending !== null}
                      onClick={() => void runAction('signout', onSignOut)}
                    >
                      {actionPending === 'signout' ? 'Выходим…' : 'Выйти из аккаунта'}
                    </button>
                  </div>
                </>
              )}

              {actionError && <div className="settings-sync__error" role="alert">{actionError}</div>}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
