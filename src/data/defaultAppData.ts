import type { AppData } from '../types/appData'
import { defaultAmounts, defaultProducts } from './defaultProducts'

export const defaultAppData: AppData = {
  products: defaultProducts,
  rationEntries: Object.entries(defaultAmounts).map(([productId, amount]) => ({
    id: `legacy:${productId}`,
    productId,
    amount,
    enabled: true,
  })),
  targets: {
    protein: 0,
    fat: 0,
    carbs: 0,
    fiber: 0,
  },
}
