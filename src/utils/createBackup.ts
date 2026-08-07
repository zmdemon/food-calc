import type { NutritionTargets, Product, RationEntry } from '../types/product'

type CreateBackupParams = {
  products: Product[]
  rationEntries: RationEntry[]
  targets: NutritionTargets
  daysInMonth: number
}

export function createBackupJson({
  products,
  rationEntries,
  targets,
  daysInMonth,
}: CreateBackupParams) {
  const productIds = new Set(products.map((product) => product.id))
  const ration = rationEntries.filter(({ productId }) => productIds.has(productId))

  return JSON.stringify({
    format: 'food-calc-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: {
      daysInMonth,
    },
    targets,
    products,
    ration,
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
