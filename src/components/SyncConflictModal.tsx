import { useEffect, useMemo, useState } from 'react'
import type { SyncConflict } from '../types/appData'
import { Icon } from './Icon'

type SyncConflictModalProps = {
  conflict: SyncConflict
  onKeepLocal: () => Promise<void>
  onKeepCloud: () => Promise<void>
  onDefer: () => void
}

const formatDate = (value: number | null) => value
  ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(value)
  : 'Неизвестно'

export function SyncConflictModal({
  conflict,
  onKeepLocal,
  onKeepCloud,
  onDefer,
}: SyncConflictModalProps) {
  const [pendingAction, setPendingAction] = useState<'local' | 'cloud' | null>(null)
  const [error, setError] = useState('')
  const targetsMatch = useMemo(
    () => JSON.stringify(conflict.local.data.targets) === JSON.stringify(conflict.cloud.data.targets),
    [conflict],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      if (!pendingAction) onDefer()
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [onDefer, pendingAction])

  const runAction = async (source: 'local' | 'cloud', action: () => Promise<void>) => {
    setPendingAction(source)
    setError('')
    try {
      await action()
    } catch {
      setError('Не удалось применить выбранную версию. Данные не были заменены.')
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="modal-backdrop modal-backdrop--conflict">
      <section className="modal sync-conflict-modal" role="alertdialog" aria-modal="true" aria-labelledby="sync-conflict-title" aria-describedby="sync-conflict-description">
        <div className="modal__head">
          <div>
            <span className="eyebrow">Синхронизация приостановлена</span>
            <h2 id="sync-conflict-title">Выберите версию данных</h2>
          </div>
          <div className="sync-conflict-modal__icon"><Icon name="cloud" size={22} /></div>
        </div>

        <p id="sync-conflict-description" className="sync-conflict-modal__intro">
          Данные на этом устройстве отличаются от данных в облаке. До вашего решения ни одна версия не будет перезаписана.
        </p>

        <div className="sync-compare" role="table" aria-label="Сравнение версий">
          <div className="sync-compare__row sync-compare__row--head" role="row">
            <span role="columnheader">Параметр</span>
            <strong role="columnheader">На устройстве</strong>
            <strong role="columnheader">В облаке</strong>
          </div>
          <div className="sync-compare__row" role="row">
            <span role="cell">Изменено</span>
            <strong role="cell">{formatDate(conflict.local.localUpdatedAt)}</strong>
            <strong role="cell">{formatDate(conflict.cloud.updatedAt)}</strong>
          </div>
          <div className="sync-compare__row" role="row">
            <span role="cell">Продуктов</span>
            <strong role="cell">{conflict.local.data.products.length}</strong>
            <strong role="cell">{conflict.cloud.data.products.length}</strong>
          </div>
          <div className="sync-compare__row" role="row">
            <span role="cell">Позиций рациона</span>
            <strong role="cell">{conflict.local.data.rationEntries.length}</strong>
            <strong role="cell">{conflict.cloud.data.rationEntries.length}</strong>
          </div>
          <div className="sync-compare__row" role="row">
            <span role="cell">Цели питания</span>
            <strong role="cell">{targetsMatch ? 'Совпадают' : 'Своя версия'}</strong>
            <strong role="cell">{targetsMatch ? 'Совпадают' : 'Своя версия'}</strong>
          </div>
        </div>

        <p className="sync-conflict-modal__hint">
          Перед заменой приложение сохранит отбрасываемую версию как резервную копию.
        </p>
        {error && <div className="sync-conflict-modal__error" role="alert">{error}</div>}

        <div className="sync-conflict-modal__actions">
          <button className="button button--ghost" type="button" disabled={pendingAction !== null} onClick={onDefer}>
            Решить позже
          </button>
          <div>
            <button className="button button--ghost" type="button" disabled={pendingAction !== null} onClick={() => void runAction('cloud', onKeepCloud)}>
              {pendingAction === 'cloud' ? 'Загрузка…' : 'Использовать облако'}
            </button>
            <button className="button button--primary" type="button" disabled={pendingAction !== null} onClick={() => void runAction('local', onKeepLocal)}>
              {pendingAction === 'local' ? 'Сохранение…' : 'Использовать устройство'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
