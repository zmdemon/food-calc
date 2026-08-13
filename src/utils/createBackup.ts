import type { RationTab } from '../types/appData'
import type { NutritionTargets, Product } from '../types/product'

type CreateBackupParams = {
  products: Product[]
  rationTabs: RationTab[]
  targets: NutritionTargets
  daysInMonth: number
}

export function createBackupJson({
  products,
  rationTabs,
  targets,
  daysInMonth,
}: CreateBackupParams) {
  const productIds = new Set(products.map((product) => product.id))
  const normalizedTabs = rationTabs.map((tab) => ({
    ...tab,
    rationEntries: tab.rationEntries.filter(({ productId }) => productIds.has(productId)),
  }))

  return JSON.stringify({
    format: 'food-calc-backup',
    version: 3,
    exportedAt: new Date().toISOString(),
    settings: {
      daysInMonth,
    },
    targets,
    products,
    rationTabs: normalizedTabs,
  }, null, 2)
}

export function downloadBackup(source: string) {
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([source], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `food-calc-backup-${date}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
