import type { ProductFormValues } from '../types/product'

const numericFields = [
  'protein',
  'fat',
  'carbs',
  'fiber',
  'calories',
  'packagePrice',
  'packageWeight',
] as const

type NumericField = (typeof numericFields)[number]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readNumber = (source: Record<string, unknown>, field: NumericField) => {
  const value = source[field]
  if (value === undefined || value === null || value === '') return 0
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Invalid numeric field')
  }
  return value
}

const parseProduct = (value: unknown): ProductFormValues => {
  if (!isRecord(value) || typeof value.name !== 'string' || !value.name.trim()) {
    throw new Error('Invalid product')
  }

  return {
    name: value.name.trim(),
    protein: readNumber(value, 'protein'),
    fat: readNumber(value, 'fat'),
    carbs: readNumber(value, 'carbs'),
    fiber: readNumber(value, 'fiber'),
    calories: readNumber(value, 'calories'),
    packagePrice: readNumber(value, 'packagePrice'),
    packageWeight: readNumber(value, 'packageWeight'),
  }
}

export function parseProductsJson(source: string): ProductFormValues[] {
  const parsed: unknown = JSON.parse(source)
  const items = Array.isArray(parsed) ? parsed : [parsed]

  if (items.length === 0) throw new Error('Empty product list')
  return items.map(parseProduct)
}
