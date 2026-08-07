import { useEffect, useMemo, useState } from 'react'
import type { Product } from '../types/product'
import { formatMoney, formatNumber } from '../utils/calculations'
import { Icon } from './Icon'

type CatalogModalProps = {
  products: Product[]
  rationProductIds: Set<string>
  notice?: string
  onAddToRation: (productId: string) => void
  onCreate: () => void
  onImport: () => void
  onExport: () => void
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onClose: () => void
}

export function CatalogModal({
  products,
  rationProductIds,
  notice,
  onAddToRation,
  onCreate,
  onImport,
  onExport,
  onEdit,
  onDelete,
  onClose,
}: CatalogModalProps) {
  const [query, setQuery] = useState('')
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ru')
    return normalizedQuery
      ? products.filter((product) => product.name.toLocaleLowerCase('ru').includes(normalizedQuery))
      : products
  }, [products, query])

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

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal catalog-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-title">
        <div className="modal__head catalog-modal__head">
          <div>
            <span className="eyebrow">Ваши продукты</span>
            <h2 id="catalog-title">Каталог продуктов</h2>
            <p>Добавляйте продукты в типичный день или управляйте каталогом.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть каталог">
            <Icon name="close" size={21} />
          </button>
        </div>

        <div className="catalog-toolbar">
          <label className="catalog-search">
            <span className="sr-only">Поиск по каталогу</span>
            <input
              type="search"
              value={query}
              placeholder="Найти продукт"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="button button--ghost" type="button" onClick={onImport}>
            Импорт JSON
          </button>
          <button className="button button--ghost" type="button" onClick={onExport}>
            Экспорт данных
          </button>
          <button className="button button--primary" type="button" onClick={onCreate}>
            <Icon name="plus" size={17} />
            Новый продукт
          </button>
        </div>

        {notice && <div className="catalog-notice" role="status">{notice}</div>}

        <div className="catalog-list">
          {filteredProducts.map((product) => {
            const isInRation = rationProductIds.has(product.id)
            return (
              <article className="catalog-item" key={product.id}>
                <div className="catalog-item__main">
                  <strong>{product.name}</strong>
                  <span>
                    Б {formatNumber(product.protein, 1)} · Ж {formatNumber(product.fat, 1)} · У {formatNumber(product.carbs, 1)} · {formatNumber(product.calories)} ккал
                  </span>
                  <small>{formatMoney(product.packagePrice)} за {product.packageWeight} г</small>
                </div>
                <div className="catalog-item__actions">
                  <button
                    className={`catalog-add ${isInRation ? 'catalog-add--added' : ''}`}
                    type="button"
                    disabled={isInRation}
                    onClick={() => onAddToRation(product.id)}
                  >
                    {isInRation ? 'В рационе' : <><Icon name="plus" size={15} /> В рацион</>}
                  </button>
                  <div className="row-actions">
                    <button type="button" onClick={() => onEdit(product)} aria-label={`Редактировать ${product.name}`}>
                      <Icon name="edit" size={17} />
                    </button>
                    <button className="row-actions__danger" type="button" onClick={() => onDelete(product)} aria-label={`Удалить ${product.name} из каталога`}>
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}

          {filteredProducts.length === 0 && (
            <div className="catalog-empty">
              <strong>{products.length === 0 ? 'Каталог пока пуст' : 'Ничего не найдено'}</strong>
              <span>{products.length === 0 ? 'Создайте первый продукт.' : 'Попробуйте изменить запрос.'}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
