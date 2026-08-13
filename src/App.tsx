import { useEffect, useMemo, useState } from 'react'
import { AccountControl } from './components/AccountControl'
import { CatalogModal } from './components/CatalogModal'
import { ExportModal } from './components/ExportModal'
import { Icon } from './components/Icon'
import { ImportModal } from './components/ImportModal'
import { ProductList } from './components/ProductList'
import { ProductModal } from './components/ProductModal'
import { RationTabs } from './components/RationTabs'
import { SettingsModal } from './components/SettingsModal'
import { Summary } from './components/Summary'
import { SyncConflictModal } from './components/SyncConflictModal'
import { TargetsModal } from './components/TargetsModal'
import { useAppData } from './hooks/useAppData'
import type { RationTab } from './types/appData'
import type { Product, ProductFormValues, RationEntry, RationItem } from './types/product'
import { calculateTotals } from './utils/calculations'
import { createBackupJson, downloadBackup } from './utils/createBackup'
import { createRationReport } from './utils/createRationReport'

type OverlayState =
  | { type: 'closed' }
  | { type: 'catalog' }
  | { type: 'import' }
  | { type: 'settings' }
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
  const {
    products,
    rationTabs,
    targets,
    user,
    authReady,
    dataReady,
    syncState,
    conflict,
    conflictBackup,
    setProducts,
    setRationTabs,
    setTargets,
    signIn,
    signOut,
    syncNow,
    keepLocalVersion,
    keepCloudVersion,
  } = useAppData()
  const [overlay, setOverlay] = useState<OverlayState>({ type: 'closed' })
  const [catalogNotice, setCatalogNotice] = useState('')
  const [activeTabId, setActiveTabId] = useState(() => rationTabs[0]?.id ?? '')
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [deferredConflictRevision, setDeferredConflictRevision] = useState<number | null>(null)
  const daysInMonth = 30

  const activeTab = rationTabs.find((tab) => tab.id === activeTabId) ?? rationTabs[0]
  const rationEntries = activeTab?.rationEntries ?? []

  useEffect(() => {
    if (!rationTabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(rationTabs[0]?.id ?? '')
    }
  }, [activeTabId, rationTabs])

  useEffect(() => {
    if (!conflict) {
      setConflictDialogOpen(false)
      setDeferredConflictRevision(null)
      return
    }
    if (conflict.cloud.revision !== deferredConflictRevision) setConflictDialogOpen(true)
  }, [conflict, deferredConflictRevision])

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
      rationTabs,
      targets,
      daysInMonth,
    })
    downloadBackup(backup)
  }

  const downloadConflictBackup = () => {
    if (!conflictBackup) return
    downloadBackup(createBackupJson({
      ...conflictBackup.data,
      daysInMonth,
    }))
  }

  const updateActiveRationEntries = (
    updater: (entries: RationEntry[]) => RationEntry[],
  ) => {
    if (!activeTab) return
    setRationTabs((current) => current.map((tab) => (
      tab.id === activeTab.id
        ? { ...tab, rationEntries: updater(tab.rationEntries) }
        : tab
    )))
  }

  const createRationTab = () => {
    const nextTab: RationTab = {
      id: crypto.randomUUID(),
      name: `Набор ${rationTabs.length + 1}`,
      rationEntries: [],
    }
    setRationTabs((current) => [...current, nextTab])
    setActiveTabId(nextTab.id)
  }

  const renameRationTab = (tabId: string, name: string) => {
    const normalizedName = name.trim().slice(0, 60)
    if (!normalizedName) return
    setRationTabs((current) => current.map((tab) => (
      tab.id === tabId && tab.name !== normalizedName ? { ...tab, name: normalizedName } : tab
    )))
  }

  const deleteRationTab = (tabId: string) => {
    if (rationTabs.length <= 1) return
    const tabIndex = rationTabs.findIndex((tab) => tab.id === tabId)
    if (tabIndex < 0) return

    const tab = rationTabs[tabIndex]
    if (
      tab.rationEntries.length > 0
      && !window.confirm(`Удалить вкладку «${tab.name}» и все продукты в ней?`)
    ) return

    setRationTabs((current) => current.length > 1
      ? current.filter((item) => item.id !== tabId)
      : current)
    if (tabId === activeTabId) {
      setActiveTabId(rationTabs[tabIndex - 1]?.id ?? rationTabs[1].id)
    }
  }

  const addToRation = (productId: string) => {
    updateActiveRationEntries((current) => [...current, {
      id: crypto.randomUUID(),
      productId,
      amount: 100,
      enabled: true,
    }])
  }

  const removeFromRation = (entryId: string) => {
    updateActiveRationEntries((current) => current.filter((entry) => entry.id !== entryId))
  }

  const updateRationAmount = (entryId: string, amount: number) => {
    updateActiveRationEntries((current) => current.map((entry) => (
      entry.id === entryId ? { ...entry, amount } : entry
    )))
  }

  const toggleProductVisibility = (entryId: string) => {
    updateActiveRationEntries((current) => current.map((entry) => (
      entry.id === entryId ? { ...entry, enabled: !entry.enabled } : entry
    )))
  }

  const setAllProductsVisibility = (enabled: boolean) => {
    updateActiveRationEntries((current) => current.map((entry) => ({ ...entry, enabled })))
  }

  const reorderRation = (entryIds: string[]) => {
    updateActiveRationEntries((current) => {
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
    if (!window.confirm(`Удалить «${product.name}» из каталога? Все его позиции также исчезнут из всех вкладок.`)) return
    setProducts((current) => current.filter((item) => item.id !== product.id))
    setRationTabs((current) => current.map((tab) => ({
      ...tab,
      rationEntries: tab.rationEntries.filter((entry) => entry.productId !== product.id),
    })))
  }

  if (!dataReady) {
    return (
      <main className="app-loader" aria-busy="true" aria-live="polite">
        <div className="app-loader__card" role="status">
          <span className="app-loader__brand"><Icon name="leaf" size={25} /></span>
          <span className="app-loader__spinner" aria-hidden="true" />
          <strong>{authReady ? 'Синхронизация данных…' : 'Подготовка приложения…'}</strong>
          <p>Загружаем актуальную версию каталога и рациона</p>
        </div>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar__inner">
          <a className="brand" href="#top" aria-label="Рацион — на главную">
            <span className="brand__mark"><Icon name="leaf" size={21} /></span>
            <span>
              <strong>Калькулятор еды</strong>
              <small>бжу+стоимость в день/месяц</small>
            </span>
          </a>
          <div className="topbar__actions">
            <button className="icon-button settings-button" type="button" onClick={() => setOverlay({ type: 'settings' })} aria-label="Открыть настройки" title="Настройки">
              <Icon name="settings" size={20} />
            </button>
            {/*<button className="button button--primary button--catalog" type="button" onClick={() => setOverlay({ type: 'catalog' })}>*/}
            {/*  <Icon name="plus" size={18} />*/}
            {/*  <span>Каталог продуктов</span>*/}
            {/*</button>*/}
            <AccountControl
              user={user}
              authReady={authReady}
              syncState={syncState}
              onSignIn={signIn}
              onSignOut={signOut}
            />
          </div>
        </div>
      </header>

      <main id="top" className="container page-content">
        <Summary
          totals={totals}
          targets={targets}
          daysInMonth={daysInMonth}
          onOpenTargets={() => setOverlay({ type: 'targets' })}
        />

        <section className="ration-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Состав</span>
              <h2>Дневной набор продуктов</h2>
              <p>v1.0</p>
            </div>
            <div className="section-heading__actions">
              <div className="section-heading__count">
                {rationItems.length} {productWord(rationItems.length)}
              </div>
              <button className="button button--primary" type="button" onClick={() => setOverlay({ type: 'catalog' })}>
                <Icon name="plus" size={17} />
                <span>Добавить</span>
              </button>
            </div>
          </div>
          <RationTabs
            tabs={rationTabs}
            activeTabId={activeTab?.id ?? ''}
            onSelect={setActiveTabId}
            onCreate={createRationTab}
            onRename={renameRationTab}
            onDelete={deleteRationTab}
          />
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
        <span>{user
          ? syncState.phase === 'conflict'
            ? 'Синхронизация приостановлена до выбора версии'
            : syncState.phase === 'offline'
              ? 'Изменения сохраняются локально до подключения'
              : 'Данные синхронизируются с аккаунтом Google'
          : 'Данные хранятся только на этом устройстве'}</span>
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
          onClose={() => setOverlay({ type: 'settings' })}
        />
      )}

      {overlay.type === 'settings' && (
        <SettingsModal
          user={user}
          authReady={authReady}
          syncState={syncState}
          conflict={conflict}
          conflictBackup={conflictBackup}
          onClose={() => setOverlay({ type: 'closed' })}
          onOpenRationExport={() => setOverlay({ type: 'export' })}
          onExportBackup={exportBackup}
          onDownloadConflictBackup={downloadConflictBackup}
          onOpenConflict={() => setConflictDialogOpen(true)}
          onSignIn={signIn}
          onSignOut={signOut}
          onSyncNow={syncNow}
        />
      )}

      {conflict && conflictDialogOpen && (
        <SyncConflictModal
          conflict={conflict}
          onKeepLocal={keepLocalVersion}
          onKeepCloud={keepCloudVersion}
          onDefer={() => {
            setDeferredConflictRevision(conflict.cloud.revision)
            setConflictDialogOpen(false)
          }}
        />
      )}
    </div>
  )
}
