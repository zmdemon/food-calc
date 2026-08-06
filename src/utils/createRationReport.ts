import type { NutritionTargets, NutritionTotals, Product, RationAmounts } from '../types/product'
import { formatNumber } from './calculations'

type CreateRationReportParams = {
  products: Product[]
  amounts: RationAmounts
  totals: NutritionTotals
  targets: NutritionTargets
}

const grams = (value: number) => `${formatNumber(value, 1)} г`
const targetValue = (value: number) => value > 0 ? grams(value) : '—'
const escapeCell = (value: string) => value.replaceAll('|', '\\|').replaceAll(/\r?\n/g, ' ')

export function createRationReport({ products, amounts, totals, targets }: CreateRationReportParams) {
  const lines = [
    '# Типичный дневной рацион',
    '',
    '## Итоги за день',
    '',
    '| Показатель | Значение | Цель |',
    '|---|---:|---:|',
    `| Калорийность | ${formatNumber(totals.calories)} ккал | — |`,
    `| Белки | ${grams(totals.protein)} | ${targetValue(targets.protein)} |`,
    `| Жиры | ${grams(totals.fat)} | ${targetValue(targets.fat)} |`,
    `| Углеводы | ${grams(totals.carbs)} | ${targetValue(targets.carbs)} |`,
    `| Клетчатка | ${grams(totals.fiber)} | ${targetValue(targets.fiber)} |`,
    '',
    '## Продукты',
    '',
    '| Продукт | Количество | Ккал | Белки | Жиры | Углеводы | Клетчатка |',
    '|---|---:|---:|---:|---:|---:|---:|',
  ]

  products.forEach((product) => {
    const amount = amounts[product.id] ?? 0
    const factor = amount / 100
    lines.push(
      `| ${escapeCell(product.name)} | ${formatNumber(amount)} г | ${formatNumber(product.calories * factor)} | ${grams(product.protein * factor)} | ${grams(product.fat * factor)} | ${grams(product.carbs * factor)} | ${grams(product.fiber * factor)} |`,
    )
  })

  return lines.join('\n')
}
