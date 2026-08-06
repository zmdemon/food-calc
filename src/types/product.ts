export type Product = {
  id: string
  name: string
  protein: number
  fat: number
  carbs: number
  fiber: number
  calories: number
  packagePrice: number
  packageWeight: number
}

export type RationAmounts = Record<string, number>

export type ProductFormValues = Omit<Product, 'id'>

export type NutritionTotals = {
  protein: number
  fat: number
  carbs: number
  fiber: number
  calories: number
  cost: number
}
