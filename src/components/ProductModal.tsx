import { useEffect, useId, useState } from 'react'
import type { Product, ProductFormValues } from '../types/product'
import { Icon } from './Icon'

type ProductModalProps = {
  product: Product | null
  onClose: () => void
  onSave: (values: ProductFormValues) => void
}

type NumberField = Exclude<keyof ProductFormValues, 'name'>
type ProductFormDraft = { name: string } & Record<NumberField, string>

const initialValues: ProductFormDraft = {
  name: '',
  protein: '',
  fat: '',
  carbs: '',
  fiber: '',
  calories: '',
  packagePrice: '',
  packageWeight: '',
}

const numberFields: NumberField[] = [
  'protein',
  'fat',
  'carbs',
  'fiber',
  'calories',
  'packagePrice',
  'packageWeight',
]

const createDraft = (product: Product | null): ProductFormDraft => {
  if (!product) return initialValues

  return numberFields.reduce<ProductFormDraft>(
    (draft, field) => ({ ...draft, [field]: String(product[field]).replace('.', ',') }),
    { ...initialValues, name: product.name },
  )
}

const normalizeDecimalInput = (value: string) => value.replaceAll('.', ',')

const isDecimalDraft = (value: string) => /^\d*(?:,\d*)?$/.test(value)

const parseOptionalNumber = (value: string) => {
  if (value.trim() === '') return 0
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function NumberInput({ label, field, value, suffix, onChange }: {
  label: string
  field: NumberField
  value: string
  suffix: string
  onChange: (field: NumberField, value: string) => void
}) {
  const id = useId()
  return (
    <label className="form-field" htmlFor={id}>
      <span>{label}</span>
      <div className="form-field__input">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          placeholder="0"
          onChange={(event) => {
            const normalizedValue = normalizeDecimalInput(event.target.value)
            if (isDecimalDraft(normalizedValue)) onChange(field, normalizedValue)
          }}
        />
        <i>{suffix}</i>
      </div>
    </label>
  )
}

export function ProductModal({ product, onClose, onSave }: ProductModalProps) {
  const [values, setValues] = useState<ProductFormDraft>(() => createDraft(product))

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

  const updateNumber = (field: NumberField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!values.name.trim()) return
    onSave({
      name: values.name.trim(),
      protein: parseOptionalNumber(values.protein),
      fat: parseOptionalNumber(values.fat),
      carbs: parseOptionalNumber(values.carbs),
      fiber: parseOptionalNumber(values.fiber),
      calories: parseOptionalNumber(values.calories),
      packagePrice: parseOptionalNumber(values.packagePrice),
      packageWeight: parseOptionalNumber(values.packageWeight),
    })
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal__head">
          <div>
            <span className="eyebrow">Каталог</span>
            <h2 id="modal-title">{product ? 'Редактировать продукт' : 'Новый продукт'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть окно">
            <Icon name="close" size={21} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="form-field form-field--full">
            <span>Название продукта</span>
            <div className="form-field__input">
              <input
                autoFocus
                type="text"
                value={values.name}
                placeholder="Например, авокадо"
                onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </div>
          </label>

          <div className="form-section">
            <div className="form-section__title">
              <span>На 100 грамм</span>
              <i>Ноль допустим</i>
            </div>
            <div className="form-grid form-grid--nutrition">
              <NumberInput label="Белки" field="protein" value={values.protein} suffix="г" onChange={updateNumber} />
              <NumberInput label="Жиры" field="fat" value={values.fat} suffix="г" onChange={updateNumber} />
              <NumberInput label="Углеводы" field="carbs" value={values.carbs} suffix="г" onChange={updateNumber} />
              <NumberInput label="Клетчатка" field="fiber" value={values.fiber} suffix="г" onChange={updateNumber} />
              <NumberInput label="Калорийность" field="calories" value={values.calories} suffix="ккал" onChange={updateNumber} />
            </div>
          </div>

          <div className="form-section">
            <div className="form-section__title"><span>Упаковка</span><i>Цена может быть нулевой</i></div>
            <div className="form-grid">
              <NumberInput label="Цена" field="packagePrice" value={values.packagePrice} suffix="₽" onChange={updateNumber} />
              <NumberInput label="Вес" field="packageWeight" value={values.packageWeight} suffix="г" onChange={updateNumber} />
            </div>
          </div>

          <div className="modal__actions">
            <button className="button button--ghost" type="button" onClick={onClose}>Отмена</button>
            <button className="button button--primary" type="submit">{product ? 'Сохранить' : 'Добавить продукт'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
