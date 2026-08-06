import type { NutritionTotals } from '../types/product'
import { formatMoney, formatNumber } from '../utils/calculations'
import { Icon } from './Icon'

type SummaryProps = {
  totals: NutritionTotals
  daysInMonth: number
}

const nutrientCards = [
  { key: 'protein', label: 'Белки', short: 'Б', tone: 'protein' },
  { key: 'fat', label: 'Жиры', short: 'Ж', tone: 'fat' },
  { key: 'carbs', label: 'Углеводы', short: 'У', tone: 'carbs' },
  { key: 'fiber', label: 'Клетчатка', short: 'Кл', tone: 'fiber' },
] as const

export function Summary({ totals, daysInMonth }: SummaryProps) {
  return (
    <section className="summary" aria-label="Сводка рациона">
      <div className="summary__heading">
        <div>
          <span className="eyebrow">Сводка рациона</span>
          <h1>Ваш типичный день</h1>
        </div>
        <div className="summary__period">Расчёт на {daysInMonth} дней</div>
      </div>

      <div className="summary__grid">
        <article className="metric-card metric-card--calories">
          <div className="metric-card__icon"><Icon name="leaf" size={22} /></div>
          <div>
            <span className="metric-card__label">Энергия за день</span>
            <strong>{formatNumber(totals.calories)}</strong>
            <span className="metric-card__unit">ккал</span>
          </div>
        </article>

        <article className="metric-card metric-card--cost">
          <div className="metric-card__icon"><Icon name="wallet" size={22} /></div>
          <div className="metric-card__costs">
            <div>
              <span className="metric-card__label">Стоимость дня</span>
              <strong>{formatMoney(totals.cost)}</strong>
            </div>
            <div className="metric-card__divider" />
            <div>
              <span className="metric-card__label">В месяц</span>
              <strong>{formatMoney(totals.cost * daysInMonth)}</strong>
            </div>
          </div>
        </article>

        <article className="macro-card">
          {nutrientCards.map((item) => (
            <div className="macro-card__item" key={item.key}>
              <span className={`macro-card__badge macro-card__badge--${item.tone}`}>
                {item.short}
              </span>
              <div>
                <span>{item.label}</span>
                <strong>{formatNumber(totals[item.key], 1)} г</strong>
              </div>
            </div>
          ))}
        </article>
      </div>
    </section>
  )
}
