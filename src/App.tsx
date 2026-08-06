import { useMemo, useState } from 'react'
import { CatalogModal } from './components/CatalogModal'
import { ExportModal } from './components/ExportModal'
import { Icon } from './components/Icon'
import { ImportModal } from './components/ImportModal'
import { ProductList } from './components/ProductList'
import { ProductModal } from './components/ProductModal'
import { Summary } from './components/Summary'
import { TargetsModal } from './components/TargetsModal'
import { defaultAmounts, defaultProducts } from './data/defaultProducts'
import { useLocalStorage } from './hooks/useLocalStorage'
import type { NutritionTargets, Product, ProductFormValues, RationAmounts } from './types/product'
import { calculateTotals } from './utils/calculations'
import { createRationReport } from './utils/createRationReport'

const PRODUCTS_KEY = 'food-calc.products.v1'
const AMOUNTS_KEY = 'food-calc.amounts.v1'
const TARGETS_KEY = 'food-calc.targets.v1'
const HIDDEN_PRODUCTS_KEY = 'food-calc.hidden-products.v1'

const defaultTargets: NutritionTargets = {
  protein: 0,
  fat: 0,
  carbs: 0,
  fiber: 0,
}

type OverlayState =
  | { type: 'closed' }
  | { type: 'catalog' }
  | { type: 'import' }
  | { type: 'targets' }
  | { type: 'export' }
  | { type: 'product'; product: Product | null }

const productWord = (count: number) => {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 19) return 'продуктов'
  if (last === 1) return 'продукт'
  if (last >= 2 && last <= 4) return 'продукта'
  return 'продуктов'
}

export function App() {
  const [products, setProducts] = useLocalStorage<Product[]>(PRODUCTS_KEY, defaultProducts)
  const [amounts, setAmounts] = useLocalStorage<RationAmounts>(AMOUNTS_KEY, defaultAmounts)
  const [targets, setTargets] = useLocalStorage<NutritionTargets>(TARGETS_KEY, defaultTargets)
  const [hiddenProducts, setHiddenProducts] = useLocalStorage<Record<string, boolean>>(HIDDEN_PRODUCTS_KEY, {})
  const [overlay, setOverlay] = useState<OverlayState>({ type: 'closed' })
  const [catalogNotice, setCatalogNotice] = useState('')
  const daysInMonth = 30

  const rationProducts = useMemo(
    () => products.filter((product) => Object.prototype.hasOwnProperty.call(amounts, product.id)),
    [products, amounts],
  )
  const activeProducts = useMemo(
    () => rationProducts.filter((product) => !hiddenProducts[product.id]),
    [rationProducts, hiddenProducts],
  )
  const totals = useMemo(() => calculateTotals(activeProducts, amounts), [activeProducts, amounts])

  const saveProduct = (values: ProductFormValues) => {
    if (overlay.type === 'product' && overlay.product) {
      setProducts((current) => current.map((item) =>
        item.id === overlay.product?.id ? { ...values, id: item.id } : item,
      ))
    } else {
      setProducts((current) => [...current, { ...values, id: crypto.randomUUID() }])
    }
    setOverlay({ type: 'catalog' })
  }

  const importProducts = (values: ProductFormValues[]) => {
    const imported = values.map((product) => ({ ...product, id: crypto.randomUUID() }))
    setProducts((current) => [...current, ...imported])
    setCatalogNotice(`Добавлено продуктов: ${imported.length}`)
    setOverlay({ type: 'catalog' })
  }

  const addToRation = (productId: string) => {
    setAmounts((current) => ({ ...current, [productId]: 100 }))
    setHiddenProducts((current) => {
      const next = { ...current }
      delete next[productId]
      return next
    })
  }

  const removeFromRation = (productId: string) => {
    setAmounts((current) => {
      const next = { ...current }
      delete next[productId]
      return next
    })
    setHiddenProducts((current) => {
      const next = { ...current }
      delete next[productId]
      return next
    })
  }

  const toggleProductVisibility = (productId: string) => {
    setHiddenProducts((current) => {
      const next = { ...current }
      if (next[productId]) delete next[productId]
      else next[productId] = true
      return next
    })
  }

  const deleteFromCatalog = (product: Product) => {
    if (!window.confirm(`Удалить «${product.name}» из каталога? Продукт также исчезнет из дневного рациона.`)) return
    setProducts((current) => current.filter((item) => item.id !== product.id))
    removeFromRation(product.id)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar__inner">
          <a className="brand" href="#top" aria-label="Рацион — на главную">
            <span className="brand__mark"><Icon name="leaf" size={21} /></span>
            <span>
              <strong>Рацион</strong>
              <small>калькулятор питания</small>
            </span>
          </a>
          <button className="button button--primary button--catalog" type="button" onClick={() => setOverlay({ type: 'catalog' })}>
            <Icon name="leaf" size={18} />
            <span>Каталог продуктов</span>
          </button>
        </div>
      </header>

      <main id="top" className="container page-content">
        <Summary
          totals={totals}
          targets={targets}
          daysInMonth={daysInMonth}
          onOpenTargets={() => setOverlay({ type: 'targets' })}
          onOpenExport={() => setOverlay({ type: 'export' })}
        />

        <section className="ration-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Состав</span>
              <h2>Продукты на день</h2>
              <p>Укажите привычное количество — расчёты обновятся автоматически.</p>
            </div>
            <div className="section-heading__actions">
              <div className="section-heading__count">
                {rationProducts.length} {productWord(rationProducts.length)}
              </div>
              <button className="button button--primary" type="button" onClick={() => setOverlay({ type: 'catalog' })}>
                <Icon name="plus" size={17} />
                <span>Добавить из каталога</span>
              </button>
            </div>
          </div>
          <ProductList
            products={rationProducts}
            amounts={amounts}
            hiddenProductIds={new Set(Object.keys(hiddenProducts).filter((id) => hiddenProducts[id]))}
            onAmountChange={(productId, amount) => setAmounts((current) => ({ ...current, [productId]: amount }))}
            onToggleVisibility={toggleProductVisibility}
            onEdit={(product) => setOverlay({ type: 'product', product })}
            onRemove={(product) => removeFromRation(product.id)}
            onOpenCatalog={() => setOverlay({ type: 'catalog' })}
          />
        </section>
      </main>

      <footer className="footer container">
        <span>Данные хранятся только на этом устройстве</span>
        <span>Расчёт носит информационный характер</span>
      </footer>

      {overlay.type === 'catalog' && (
        <CatalogModal
          products={products}
          rationProductIds={new Set(Object.keys(amounts))}
          notice={catalogNotice}
          onAddToRation={addToRation}
          onCreate={() => setOverlay({ type: 'product', product: null })}
          onImport={() => setOverlay({ type: 'import' })}
          onEdit={(product) => setOverlay({ type: 'product', product })}
          onDelete={deleteFromCatalog}
          onClose={() => setOverlay({ type: 'closed' })}
        />
      )}

      {overlay.type === 'import' && (
        <ImportModal
          onClose={() => setOverlay({ type: 'catalog' })}
          onImport={importProducts}
        />
      )}

      {overlay.type === 'product' && (
        <ProductModal
          product={overlay.product}
          onClose={() => setOverlay({ type: 'catalog' })}
          onSave={saveProduct}
        />
      )}

      {overlay.type === 'targets' && (
        <TargetsModal
          targets={targets}
          onClose={() => setOverlay({ type: 'closed' })}
          onSave={(nextTargets) => {
            setTargets(nextTargets)
            setOverlay({ type: 'closed' })
          }}
        />
      )}

      {overlay.type === 'export' && (
        <ExportModal
          report={createRationReport({ products: activeProducts, amounts, totals, targets })}
          onClose={() => setOverlay({ type: 'closed' })}
        />
      )}
    </div>
  )
}
