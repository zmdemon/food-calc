import { Icon } from './Icon'

type QuantityControlProps = {
  value: number
  onChange: (value: number) => void
  label: string
}

export function QuantityControl({ value, onChange, label }: QuantityControlProps) {
  const update = (nextValue: number) => onChange(Math.max(0, Math.min(5000, nextValue)))

  return (
    <div className="quantity-control">
      <button type="button" onClick={() => update(value - 10)} aria-label={`Уменьшить ${label}`}>
        <Icon name="minus" size={15} />
      </button>
      <label>
        <span className="sr-only">Количество продукта «{label}» в граммах</span>
        <input
          type="number"
          min="0"
          max="5000"
          step="10"
          value={value}
          onChange={(event) => update(Number(event.target.value) || 0)}
        />
        <span>г</span>
      </label>
      <button type="button" onClick={() => update(value + 10)} aria-label={`Увеличить ${label}`}>
        <Icon name="plus" size={15} />
      </button>
    </div>
  )
}
