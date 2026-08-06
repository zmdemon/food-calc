import { useEffect, useState } from 'react'
import { Icon } from './Icon'

type ExportModalProps = {
  report: string
  onClose: () => void
}

export function ExportModal({ report, onClose }: ExportModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')

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

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="modal__head">
          <div>
            <span className="eyebrow">Текущий рацион</span>
            <h2 id="export-title">Экспорт Markdown</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть экспорт">
            <Icon name="close" size={21} />
          </button>
        </div>

        <label className="export-field">
          <span className="sr-only">Текст отчёта</span>
          <textarea readOnly value={report} onFocus={(event) => event.target.select()} />
        </label>

        {copyState === 'error' && (
          <div className="import-error" role="alert">Не удалось скопировать текст. Выделите его вручную.</div>
        )}

        <div className="modal__actions">
          <button className="button button--ghost" type="button" onClick={onClose}>Закрыть</button>
          <button className="button button--primary" type="button" onClick={copyReport}>
            {copyState === 'copied' ? 'Скопировано' : 'Скопировать'}
          </button>
        </div>
      </section>
    </div>
  )
}
