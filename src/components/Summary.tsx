import type { NutritionTargets, NutritionTotals } from '../types/product'
import { formatMoney, formatNumber } from '../utils/calculations'
import { Icon } from './Icon'

type SummaryProps = {
  totals: NutritionTotals
  targets: NutritionTargets
  daysInMonth: number
  onOpenTargets: () => void
}

const nutrientCards = [
  { key: 'protein', label: 'Белки', short: 'Б', tone: 'protein' },
  { key: 'fat', label: 'Жиры', short: 'Ж', tone: 'fat' },
  { key: 'carbs', label: 'Углеводы', short: 'У', tone: 'carbs' },
  { key: 'fiber', label: 'Клетчатка', short: 'Кл', tone: 'fiber' },
] as const

export function Summary({ totals, targets, daysInMonth, onOpenTargets }: SummaryProps) {
  return (
    <section className="summary" aria-label="Сводка рациона">
      <div className="summary__heading">
        <div>
          <span className="eyebrow">Сводка</span>
          <h1>Статистика</h1>
        </div>
        <div className="summary__actions">
          {/*<div className="summary__period">Расчёт на {daysInMonth} дней</div>*/}
          <div className="summary__buttons">
            <button className="button button--ghost summary__small-button" type="button" onClick={onOpenTargets}>
              <Icon name="edit" size={15} />
              Цели нутриентов
            </button>
          </div>
        </div>
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
          {nutrientCards.map((item) => {
            const target = targets[item.key]
            const ratio = target > 0 ? totals[item.key] / target : 0
            const status = target <= 0 ? 'unset' : ratio >= 1 ? 'reached' : ratio >= 0.8 ? 'near' : 'progress'
            const percentage = Math.round(ratio * 100)

            return (
              <div className={`macro-card__item macro-card__item--${status}`} key={item.key}>
                <span className={`macro-card__badge macro-card__badge--${item.tone}`}>{item.short}</span>
                <div className="macro-card__content">
                  <div className="macro-card__label-row">
                    <span>{item.label}</span>
                    {target > 0 && <em>{percentage}%</em>}
                  </div>
                  <strong>
                    {formatNumber(totals[item.key], 1)}
                    {target > 0 && <small> / {formatNumber(target, 1)}</small>} г
                  </strong>
                  {target > 0 ? (
                    <div className="macro-card__progress" aria-label={`${item.label}: ${percentage}% от цели`}>
                      <i style={{ width: `${Math.min(100, percentage)}%` }} />
                    </div>
                  ) : (
                    <small className="macro-card__unset">Цель не задана</small>
                  )}
                </div>
              </div>
            )
          })}
        </article>
      </div>
    </section>
  )
}
