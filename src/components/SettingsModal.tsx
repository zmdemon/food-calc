import { useEffect, useState } from 'react'
import { Icon } from './Icon'

type SettingsModalProps = {
  onClose: () => void
  onOpenRationExport: () => void
  onExportBackup: () => void
}

export function SettingsModal({
  onClose,
  onOpenRationExport,
  onExportBackup,
}: SettingsModalProps) {
  const [backupExported, setBackupExported] = useState(false)

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
            <button className="settings-nav__item settings-nav__item--active" type="button" aria-current="page">
              <Icon name="database" size={18} />
              <span>Данные</span>
            </button>
          </nav>

          <div className="settings-content">
            <div className="settings-content__head">
              <h3>Экспорт данных</h3>
              <p>Сохраните отчёт по текущему рациону или полную копию данных приложения.</p>
            </div>

            <div className="settings-export-list">
              <article className="settings-export-card">
                <div className="settings-export-card__icon">
                  <Icon name="file-text" size={21} />
                </div>
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
                <div className="settings-export-card__icon">
                  <Icon name="download" size={21} />
                </div>
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
        </div>
      </section>
    </div>
  )
}
