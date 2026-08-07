import type { NutritionTotals, RationItem } from '../types/product'

export const EMPTY_TOTALS: NutritionTotals = {
  protein: 0,
  fat: 0,
  carbs: 0,
  fiber: 0,
  calories: 0,
  cost: 0,
}

export function calculateTotals(items: RationItem[]): NutritionTotals {
  return items.reduce((totals, { entry, product }) => {
    const amount = entry.amount
    const factor = amount / 100
    const pricePerGram = product.packageWeight > 0 ? product.packagePrice / product.packageWeight : 0

    return {
      protein: totals.protein + product.protein * factor,
      fat: totals.fat + product.fat * factor,
      carbs: totals.carbs + product.carbs * factor,
      fiber: totals.fiber + product.fiber * factor,
      calories: totals.calories + product.calories * factor,
      cost: totals.cost + pricePerGram * amount,
    }
  }, EMPTY_TOTALS)
}

export const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)

export const formatMoney = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
