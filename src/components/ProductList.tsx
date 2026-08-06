import type { Product, RationAmounts } from '../types/product'
import { formatMoney, formatNumber } from '../utils/calculations'
import { Icon } from './Icon'
import { QuantityControl } from './QuantityControl'

type ProductListProps = {
  products: Product[]
  amounts: RationAmounts
  hiddenProductIds: Set<string>
  onAmountChange: (productId: string, amount: number) => void
  onToggleVisibility: (productId: string) => void
  onEdit: (product: Product) => void
  onRemove: (product: Product) => void
  onOpenCatalog: () => void
}

export function ProductList({
  products,
  amounts,
  hiddenProductIds,
  onAmountChange,
  onToggleVisibility,
  onEdit,
  onRemove,
  onOpenCatalog,
}: ProductListProps) {
  if (products.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon"><Icon name="leaf" size={30} /></div>
        <h3>Рацион пока пуст</h3>
        <p>Выберите продукты из каталога, чтобы начать расчёт.</p>
        <button className="button button--primary" type="button" onClick={onOpenCatalog}>
          <Icon name="plus" size={17} />
          Открыть каталог
        </button>
      </div>
    )
  }

  return (
    <div className="product-list">
      <div className="product-table-wrap">
        <table className="product-table">
          <thead>
            <tr>
              <th>Продукт</th>
              <th>Количество</th>
              <th>Б / Ж / У</th>
              <th>Клетчатка</th>
              <th>Ккал</th>
              <th>Стоимость</th>
              <th><span className="sr-only">Действия</span></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const amount = amounts[product.id] ?? 0
              const isHidden = hiddenProductIds.has(product.id)
              const factor = amount / 100
              const cost = product.packageWeight ? (product.packagePrice / product.packageWeight) * amount : 0
              return (
                <tr className={isHidden ? 'product-row--hidden' : ''} key={product.id}>
                  <td>
                    <div className="product-title-line">
                      <strong className="product-name">{product.name}</strong>
                    </div>
                    <span className="product-package">{formatMoney(product.packagePrice)} · {product.packageWeight} г</span>
                  </td>
                  <td>
                    <QuantityControl value={amount} label={product.name} onChange={(value) => onAmountChange(product.id, value)} />
                  </td>
                  <td>
                    <span className="macro-line">
                      <b className="macro-line__protein">{formatNumber(product.protein * factor, 1)}</b><i>/</i>
                      <b className="macro-line__fat">{formatNumber(product.fat * factor, 1)}</b><i>/</i>
                      <b className="macro-line__carbs">{formatNumber(product.carbs * factor, 1)}</b>
                    </span>
                  </td>
                  <td>{formatNumber(product.fiber * factor, 1)} г</td>
                  <td>{formatNumber(product.calories * factor)}</td>
                  <td><strong>{formatMoney(cost)}</strong></td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="row-actions__visibility"
                        type="button"
                        onClick={() => onToggleVisibility(product.id)}
                        aria-label={isHidden ? `Учитывать ${product.name} в расчётах` : `Не учитывать ${product.name} в расчётах`}
                        aria-pressed={isHidden}
                      >
                        <Icon name={isHidden ? 'eye-off' : 'eye'} size={17} />
                      </button>
                      <button type="button" onClick={() => onEdit(product)} aria-label={`Редактировать ${product.name}`}>
                        <Icon name="edit" size={17} />
                      </button>
                      <button className="row-actions__danger" type="button" onClick={() => onRemove(product)} aria-label={`Убрать ${product.name} из рациона`}>
                        <Icon name="close" size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="product-cards">
        {products.map((product) => {
          const amount = amounts[product.id] ?? 0
          const isHidden = hiddenProductIds.has(product.id)
          const factor = amount / 100
          const cost = product.packageWeight ? (product.packagePrice / product.packageWeight) * amount : 0
          return (
            <article className={`product-card ${isHidden ? 'product-card--hidden' : ''}`} key={product.id}>
              <div className="product-card__head">
                <div>
                  <div className="product-title-line">
                    <strong>{product.name}</strong>
                    {isHidden && <span className="product-paused">Не учитывается</span>}
                  </div>
                  <span>{formatMoney(product.packagePrice)} за {product.packageWeight} г</span>
                </div>
                <div className="row-actions">
                  <button
                    className="row-actions__visibility"
                    type="button"
                    onClick={() => onToggleVisibility(product.id)}
                    aria-label={isHidden ? `Учитывать ${product.name} в расчётах` : `Не учитывать ${product.name} в расчётах`}
                    aria-pressed={isHidden}
                  >
                    <Icon name={isHidden ? 'eye-off' : 'eye'} size={17} />
                  </button>
                  <button type="button" onClick={() => onEdit(product)} aria-label={`Редактировать ${product.name}`}>
                    <Icon name="edit" size={17} />
                  </button>
                  <button className="row-actions__danger" type="button" onClick={() => onRemove(product)} aria-label={`Убрать ${product.name} из рациона`}>
                    <Icon name="close" size={17} />
                  </button>
                </div>
              </div>
              <QuantityControl value={amount} label={product.name} onChange={(value) => onAmountChange(product.id, value)} />
              <div className="product-card__stats">
                <div><span>Б / Ж / У</span><strong>{formatNumber(product.protein * factor, 1)} / {formatNumber(product.fat * factor, 1)} / {formatNumber(product.carbs * factor, 1)}</strong></div>
                <div><span>Клетчатка</span><strong>{formatNumber(product.fiber * factor, 1)} г</strong></div>
                <div><span>Калории</span><strong>{formatNumber(product.calories * factor)} ккал</strong></div>
                <div><span>Стоимость</span><strong>{formatMoney(cost)}</strong></div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
