import { useEffect, useState } from 'react'
import type { ProductFormValues } from '../types/product'
import { parseProductsJson } from '../utils/importProducts'
import { Icon } from './Icon'

type ImportModalProps = {
  onClose: () => void
  onImport: (products: ProductFormValues[]) => void
}

const placeholder = `[
  {
    "name": "Куриная грудка",
    "protein": 23.6,
    "fat": 1.9,
    "carbs": 0,
    "fiber": 0,
    "calories": 113,
    "packagePrice": 349,
    "packageWeight": 700
  }
]`

export function ImportModal({ onClose, onImport }: ImportModalProps) {
  const [source, setSource] = useState('')
  const [error, setError] = useState('')

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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    try {
      onImport(parseProductsJson(source))
    } catch {
      setError('Не удалось прочитать JSON. Проверьте формат и попробуйте ещё раз.')
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="modal__head">
          <div>
            <span className="eyebrow">Каталог</span>
            <h2 id="import-title">Импорт JSON</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть импорт">
            <Icon name="close" size={21} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="import-field">
            <span>Вставьте один продукт или массив продуктов</span>
            <textarea
              autoFocus
              value={source}
              placeholder={placeholder}
              spellCheck={false}
              onChange={(event) => {
                setSource(event.target.value)
                if (error) setError('')
              }}
            />
          </label>

          <p className="import-hint">
            Обязательное поле — только <code>name</code>. Пропущенные числовые поля сохранятся как 0.
          </p>
          {error && <div className="import-error" role="alert">{error}</div>}

          <div className="modal__actions">
            <button className="button button--ghost" type="button" onClick={onClose}>Отмена</button>
            <button className="button button--primary" type="submit" disabled={!source.trim()}>Импортировать</button>
          </div>
        </form>
      </section>
    </div>
  )
}
