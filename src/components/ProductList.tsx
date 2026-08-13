import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Product, RationItem } from '../types/product'
import { formatMoney, formatNumber } from '../utils/calculations'
import { getNutrientHighlight } from '../utils/nutrientHighlight'
import { Icon } from './Icon'
import { QuantityControl } from './QuantityControl'

type ProductListProps = {
  items: RationItem[]
  onAmountChange: (entryId: string, amount: number) => void
  onToggleVisibility: (entryId: string) => void
  onSetAllVisibility: (enabled: boolean) => void
  onEdit: (product: Product) => void
  onRemove: (entryId: string) => void
  onReorder: (entryIds: string[]) => void
  onOpenCatalog: () => void
}

type SortableProductRowProps = {
  entryId: string
  product: Product
  amount: number
  isHidden: boolean
  onAmountChange: (entryId: string, amount: number) => void
  onToggleVisibility: (entryId: string) => void
  onEdit: (product: Product) => void
  onRemove: (entryId: string) => void
}

function SortableProductRow({
  entryId,
  product,
  amount,
  isHidden,
  onAmountChange,
  onToggleVisibility,
  onEdit,
  onRemove,
}: SortableProductRowProps) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entryId })
  const factor = amount / 100
  const cost = product.packageWeight ? (product.packagePrice / product.packageWeight) * amount : 0
  const nutrientHighlight = getNutrientHighlight(product, amount)
  const className = [
    isHidden ? 'product-row--hidden' : '',
    isDragging ? 'product-row--dragging' : '',
  ].filter(Boolean).join(' ')

  return (
    <tr
      ref={setNodeRef}
      className={className}
      data-dominant-nutrient={nutrientHighlight
        ? [nutrientHighlight.nutrient, nutrientHighlight.secondaryNutrient].filter(Boolean).join('+')
        : undefined}
      style={{
        ...nutrientHighlight?.style,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <td>
        <div className="product-table-product">
          <button
            ref={setActivatorNodeRef}
            className="product-drag-handle"
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Изменить порядок продукта «${product.name}»`}
          >
            <Icon name="grip-vertical" size={20} />
          </button>
          <div>
            <strong className="product-name">{product.name}</strong>
            <span className="product-package">{formatMoney(product.packagePrice)} · {product.packageWeight} г</span>
          </div>
        </div>
      </td>
      <td>
        <QuantityControl value={amount} label={product.name} onChange={(value) => onAmountChange(entryId, value)} />
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
            onClick={() => onToggleVisibility(entryId)}
            aria-label={isHidden ? `Учитывать ${product.name} в расчётах` : `Не учитывать ${product.name} в расчётах`}
            aria-pressed={isHidden}
          >
            <Icon name={isHidden ? 'eye-off' : 'eye'} size={17} />
          </button>
          <button type="button" onClick={() => onEdit(product)} aria-label={`Редактировать ${product.name}`}>
            <Icon name="edit" size={17} />
          </button>
          <button className="row-actions__danger" type="button" onClick={() => onRemove(entryId)} aria-label={`Убрать ${product.name} из рациона`}>
            <Icon name="close" size={17} />
          </button>
        </div>
      </td>
    </tr>
  )
}

export function ProductList({
  items,
  onAmountChange,
  onToggleVisibility,
  onSetAllVisibility,
  onEdit,
  onRemove,
  onReorder,
  onOpenCatalog,
}: ProductListProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex(({ entry }) => entry.id === active.id)
    const newIndex = items.findIndex(({ entry }) => entry.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    onReorder(arrayMove(items, oldIndex, newIndex).map(({ entry }) => entry.id))
  }
  const areAllProductsVisible = items.every(({ entry }) => entry.enabled)

  if (items.length === 0) {
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
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
                <th className="product-table__actions-heading">
                  <button
                    className="table-visibility-toggle"
                    type="button"
                    onClick={() => onSetAllVisibility(!areAllProductsVisible)}
                    aria-label={areAllProductsVisible ? 'Скрыть все продукты из расчёта' : 'Показать все продукты в расчёте'}
                    title={areAllProductsVisible ? 'Скрыть все' : 'Показать все'}
                  >
                    <Icon name={areAllProductsVisible ? 'eye' : 'eye-off'} size={17} />
                  </button>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <SortableContext items={items.map(({ entry }) => entry.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {items.map(({ entry, product }) => (
                  <SortableProductRow
                    key={entry.id}
                    entryId={entry.id}
                    product={product}
                    amount={entry.amount}
                    isHidden={!entry.enabled}
                    onAmountChange={onAmountChange}
                    onToggleVisibility={onToggleVisibility}
                    onEdit={onEdit}
                    onRemove={onRemove}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </DndContext>

      <div className="product-cards">
        {items.map(({ entry, product }) => {
          const amount = entry.amount
          const isHidden = !entry.enabled
          const factor = amount / 100
          const cost = product.packageWeight ? (product.packagePrice / product.packageWeight) * amount : 0
          const nutrientHighlight = getNutrientHighlight(product, amount)
          return (
            <article
              className={`product-card ${isHidden ? 'product-card--hidden' : ''}`}
              data-dominant-nutrient={nutrientHighlight
                ? [nutrientHighlight.nutrient, nutrientHighlight.secondaryNutrient].filter(Boolean).join('+')
                : undefined}
              key={entry.id}
              style={nutrientHighlight?.style}
            >
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
                    onClick={() => onToggleVisibility(entry.id)}
                    aria-label={isHidden ? `Учитывать ${product.name} в расчётах` : `Не учитывать ${product.name} в расчётах`}
                    aria-pressed={isHidden}
                  >
                    <Icon name={isHidden ? 'eye-off' : 'eye'} size={17} />
                  </button>
                  <button type="button" onClick={() => onEdit(product)} aria-label={`Редактировать ${product.name}`}>
                    <Icon name="edit" size={17} />
                  </button>
                  <button className="row-actions__danger" type="button" onClick={() => onRemove(entry.id)} aria-label={`Убрать ${product.name} из рациона`}>
                    <Icon name="close" size={17} />
                  </button>
                </div>
              </div>
              <QuantityControl value={amount} label={product.name} onChange={(value) => onAmountChange(entry.id, value)} />
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
