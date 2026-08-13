import type { CSSProperties } from 'react'
import type { Product } from '../types/product'

export type DominantNutrient = 'protein' | 'fat' | 'carbs' | 'fiber'

type NutrientHighlightProperties = CSSProperties & {
  '--nutrient-rgb': string
  '--nutrient-secondary-rgb': string
  '--nutrient-alpha': number
  '--nutrient-secondary-alpha': number
  '--nutrient-hover-alpha': number
  '--nutrient-secondary-hover-alpha': number
  '--nutrient-marker-alpha': number
  '--nutrient-secondary-marker-alpha': number
}

export type NutrientHighlight = {
  nutrient: DominantNutrient
  secondaryNutrient: DominantNutrient | null
  significance: number
  style: NutrientHighlightProperties
}

const NUTRIENT_RGB: Record<DominantNutrient, string> = {
  protein: '195, 95, 83',
  fat: '193, 138, 49',
  carbs: '110, 131, 170',
  fiber: '90, 140, 96',
}

const MAX_HIGHLIGHT_ENERGY = 250
const MAX_HIGHLIGHT_FIBER = 8
const MIN_BACKGROUND_ALPHA = 0.025
const MAX_BACKGROUND_ALPHA = 0.14
const MIN_SECONDARY_SIGNIFICANCE = 0.3
const MIN_SECONDARY_TO_PRIMARY_RATIO = 0.65

const roundAlpha = (value: number) => Math.round(value * 1000) / 1000

export function getNutrientHighlight(product: Product, amount: number): NutrientHighlight | null {
  const factor = Math.max(0, amount) / 100
  const significanceByNutrient: Record<DominantNutrient, number> = {
    protein: (product.protein * factor * 4) / MAX_HIGHLIGHT_ENERGY,
    fat: (product.fat * factor * 9) / MAX_HIGHLIGHT_ENERGY,
    carbs: (product.carbs * factor * 4) / MAX_HIGHLIGHT_ENERGY,
    fiber: (product.fiber * factor) / MAX_HIGHLIGHT_FIBER,
  }
  const rankedNutrients = (Object.entries(significanceByNutrient) as [DominantNutrient, number][])
    .sort((left, right) => right[1] - left[1])
  const [nutrient, significance] = rankedNutrients[0]
  const [secondaryCandidate, secondarySignificance] = rankedNutrients[1]

  if (significance <= 0) return null

  const secondaryNutrient = secondarySignificance >= MIN_SECONDARY_SIGNIFICANCE
    && secondarySignificance / significance >= MIN_SECONDARY_TO_PRIMARY_RATIO
    ? secondaryCandidate
    : null
  const intensity = Math.min(significance, 1)
  const secondaryIntensity = secondaryNutrient ? Math.min(secondarySignificance, 1) : intensity
  const backgroundAlpha = MIN_BACKGROUND_ALPHA
    + (MAX_BACKGROUND_ALPHA - MIN_BACKGROUND_ALPHA) * intensity
  const secondaryBackgroundAlpha = MIN_BACKGROUND_ALPHA
    + (MAX_BACKGROUND_ALPHA - MIN_BACKGROUND_ALPHA) * secondaryIntensity
  const hoverAlpha = (alpha: number) => Math.min(alpha + 0.025, 0.165)
  const markerAlpha = (value: number) => 0.36 + value * 0.5

  return {
    nutrient,
    secondaryNutrient,
    significance,
    style: {
      '--nutrient-rgb': NUTRIENT_RGB[nutrient],
      '--nutrient-secondary-rgb': NUTRIENT_RGB[secondaryNutrient ?? nutrient],
      '--nutrient-alpha': roundAlpha(backgroundAlpha),
      '--nutrient-secondary-alpha': roundAlpha(secondaryBackgroundAlpha),
      '--nutrient-hover-alpha': roundAlpha(hoverAlpha(backgroundAlpha)),
      '--nutrient-secondary-hover-alpha': roundAlpha(hoverAlpha(secondaryBackgroundAlpha)),
      '--nutrient-marker-alpha': roundAlpha(markerAlpha(intensity)),
      '--nutrient-secondary-marker-alpha': roundAlpha(markerAlpha(secondaryIntensity)),
    },
  }
}
