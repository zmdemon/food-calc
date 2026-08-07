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
import type { NutritionTargets, Product, ProductFormValues, RationAmounts, RationEntry, RationItem } from './types/product'
import { calculateTotals } from './utils/calculations'
import { createBackupJson, downloadBackup } from './utils/createBackup'
import { createRationReport } from './utils/createRationReport'

const PRODUCTS_KEY = 'food-calc.products.v1'
const AMOUNTS_KEY = 'food-calc.amounts.v1'
const TARGETS_KEY = 'food-calc.targets.v1'
const HIDDEN_PRODUCTS_KEY = 'food-calc.hidden-products.v1'
const RATION_ORDER_KEY = 'food-calc.ration-order.v1'
const RATION_ENTRIES_KEY = 'food-calc.ration-entries.v1'

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

const readLocalStorage = <T,>(key: string, fallback: T): T => {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) as T : fallback
  } catch {
    return fallback
  }
}

const migrateLegacyRation = (products: Product[]): RationEntry[] => {
  const amounts = readLocalStorage<RationAmounts>(AMOUNTS_KEY, defaultAmounts)
  const hiddenProducts = readLocalStorage<Record<string, boolean>>(HIDDEN_PRODUCTS_KEY, {})
  const legacyOrder = readLocalStorage<string[]>(RATION_ORDER_KEY, [])
  const productIds = new Set(products.map((product) => product.id))
  const remainingProductIds = new Set(
    Object.keys(amounts).filter((productId) => productIds.has(productId)),
  )
  const orderedProductIds = [
    ...legacyOrder.filter((productId) => remainingProductIds.delete(productId)),
    ...remainingProductIds,
  ]

  return orderedProductIds.map((productId) => ({
    id: `legacy:${productId}`,
    productId,
    amount: Number.isFinite(amounts[productId]) ? Math.max(0, amounts[productId]) : 0,
    enabled: !hiddenProducts[productId],
  }))
}

export function App() {
  const [products, setProducts] = useLocalStorage<Product[]>(PRODUCTS_KEY, defaultProducts)
  const [targets, setTargets] = useLocalStorage<NutritionTargets>(TARGETS_KEY, defaultTargets)
  const [rationEntries, setRationEntries] = useLocalStorage<RationEntry[]>(
    RATION_ENTRIES_KEY,
    () => migrateLegacyRation(products),
  )
  const [overlay, setOverlay] = useState<OverlayState>({ type: 'closed' })
  const [catalogNotice, setCatalogNotice] = useState('')
  const daysInMonth = 30

  const rationItems = useMemo(() => {
    const productsById = new Map(products.map((product) => [product.id, product]))
    return rationEntries.flatMap<RationItem>((entry) => {
      const product = productsById.get(entry.productId)
      return product ? [{ entry, product }] : []
    })
  }, [products, rationEntries])
  const activeRationItems = useMemo(
    () => rationItems.filter(({ entry }) => entry.enabled),
    [rationItems],
  )
  const rationProductCounts = useMemo(() => {
    const counts = new Map<string, number>()
    rationEntries.forEach(({ productId }) => counts.set(productId, (counts.get(productId) ?? 0) + 1))
    return counts
  }, [rationEntries])
  const totals = useMemo(() => calculateTotals(activeRationItems), [activeRationItems])

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

  const exportBackup = () => {
    const backup = createBackupJson({
      products,
      rationEntries,
      targets,
      daysInMonth,
    })
    downloadBackup(backup)
    setCatalogNotice('Резервная копия скачана')
  }

  const addToRation = (productId: string) => {
    setRationEntries((current) => [...current, {
      id: crypto.randomUUID(),
      productId,
      amount: 100,
      enabled: true,
    }])
  }

  const removeFromRation = (entryId: string) => {
    setRationEntries((current) => current.filter((entry) => entry.id !== entryId))
  }

  const updateRationAmount = (entryId: string, amount: number) => {
    setRationEntries((current) => current.map((entry) => (
      entry.id === entryId ? { ...entry, amount } : entry
    )))
  }

  const toggleProductVisibility = (entryId: string) => {
    setRationEntries((current) => current.map((entry) => (
      entry.id === entryId ? { ...entry, enabled: !entry.enabled } : entry
    )))
  }

  const setAllProductsVisibility = (enabled: boolean) => {
    setRationEntries((current) => current.map((entry) => ({ ...entry, enabled })))
  }

  const reorderRation = (entryIds: string[]) => {
    setRationEntries((current) => {
      const entriesById = new Map(current.map((entry) => [entry.id, entry]))
      const orderedEntries = entryIds.flatMap((entryId) => {
        const entry = entriesById.get(entryId)
        if (!entry) return []
        entriesById.delete(entryId)
        return [entry]
      })
      return [...orderedEntries, ...entriesById.values()]
    })
  }

  const deleteFromCatalog = (product: Product) => {
    if (!window.confirm(`Удалить «${product.name}» из каталога? Все его позиции также исчезнут из дневного рациона.`)) return
    setProducts((current) => current.filter((item) => item.id !== product.id))
    setRationEntries((current) => current.filter((entry) => entry.productId !== product.id))
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar__inner">
          <a className="brand" href="#top" aria-label="Рацион — на главную">
            <span className="brand__mark"><Icon name="leaf" size={21} /></span>
            <span>
              <strong>Еда считать</strong>
              <small>калькулятор еда</small>
            </span>
          </a>
          <button className="button button--primary button--catalog" type="button" onClick={() => setOverlay({ type: 'catalog' })}>
            <Icon name="leaf" size={18} />
            <span>База продуктов</span>
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
              <p>Упрощенная версия</p>
            </div>
            <div className="section-heading__actions">
              <div className="section-heading__count">
                {rationItems.length} {productWord(rationItems.length)}
              </div>
              <button className="button button--primary" type="button" onClick={() => setOverlay({ type: 'catalog' })}>
                <Icon name="plus" size={17} />
                <span>Добавить из базы</span>
              </button>
            </div>
          </div>
          <ProductList
            items={rationItems}
            onAmountChange={updateRationAmount}
            onToggleVisibility={toggleProductVisibility}
            onSetAllVisibility={setAllProductsVisibility}
            onEdit={(product) => setOverlay({ type: 'product', product })}
            onRemove={removeFromRation}
            onReorder={reorderRation}
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
          rationProductCounts={rationProductCounts}
          notice={catalogNotice}
          onAddToRation={addToRation}
          onCreate={() => setOverlay({ type: 'product', product: null })}
          onImport={() => setOverlay({ type: 'import' })}
          onExport={exportBackup}
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
          report={createRationReport({ items: activeRationItems, totals, targets })}
          onClose={() => setOverlay({ type: 'closed' })}
        />
      )}
    </div>
  )
}
