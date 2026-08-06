import { useEffect, useState } from 'react'
import type { NutritionTargets } from '../types/product'
import { Icon } from './Icon'

type TargetKey = keyof NutritionTargets
type TargetDraft = Record<TargetKey, string>

type TargetsModalProps = {
  targets: NutritionTargets
  onClose: () => void
  onSave: (targets: NutritionTargets) => void
}

const fields: Array<{ key: TargetKey; label: string }> = [
  { key: 'protein', label: 'Белки' },
  { key: 'fat', label: 'Жиры' },
  { key: 'carbs', label: 'Углеводы' },
  { key: 'fiber', label: 'Клетчатка' },
]

const createDraft = (targets: NutritionTargets): TargetDraft => ({
  protein: targets.protein > 0 ? String(targets.protein) : '',
  fat: targets.fat > 0 ? String(targets.fat) : '',
  carbs: targets.carbs > 0 ? String(targets.carbs) : '',
  fiber: targets.fiber > 0 ? String(targets.fiber) : '',
})

const parseTarget = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

export function TargetsModal({ targets, onClose, onSave }: TargetsModalProps) {
  const [draft, setDraft] = useState<TargetDraft>(() => createDraft(targets))

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
    onSave({
      protein: parseTarget(draft.protein),
      fat: parseTarget(draft.fat),
      carbs: parseTarget(draft.carbs),
      fiber: parseTarget(draft.fiber),
    })
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal targets-modal" role="dialog" aria-modal="true" aria-labelledby="targets-title">
        <div className="modal__head">
          <div>
            <span className="eyebrow">Дневные ориентиры</span>
            <h2 id="targets-title">Настроить цели</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть настройки целей">
            <Icon name="close" size={21} />
          </button>
        </div>

        <p className="targets-modal__intro">
          Укажите желаемое количество на день. Пустое значение отключает цель.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="targets-grid">
            {fields.map((field) => (
              <label className="form-field" key={field.key}>
                <span>{field.label}</span>
                <div className="form-field__input">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={draft[field.key]}
                    placeholder="Не задано"
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))}
                  />
                  <i>г</i>
                </div>
              </label>
            ))}
          </div>

          <div className="modal__actions modal__actions--split">
            <button
              className="button button--ghost button--danger-text"
              type="button"
              onClick={() => setDraft({ protein: '', fat: '', carbs: '', fiber: '' })}
            >
              Сбросить цели
            </button>
            <div>
              <button className="button button--ghost" type="button" onClick={onClose}>Отмена</button>
              <button className="button button--primary" type="submit">Сохранить</button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}
