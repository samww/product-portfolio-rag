import { describe, it, expect } from 'vitest'
import { divisionToColor, docTypeToShape, riskToHalo, pointToSize } from '../pages/EmbeddingsPage.utils'

describe('divisionToColor', () => {
  it('returns a hex string for a known division', () => {
    const color = divisionToColor('Finance')
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('returns distinct colors for different divisions', () => {
    const a = divisionToColor('Finance')
    const b = divisionToColor('Operations')
    expect(a).not.toBe(b)
  })

  it('returns a fallback hex color for an unknown division', () => {
    const color = divisionToColor('UnknownDivision')
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('same division always returns the same color', () => {
    expect(divisionToColor('Finance')).toBe(divisionToColor('Finance'))
  })
})

describe('docTypeToShape', () => {
  it('returns "sphere" for application', () => {
    expect(docTypeToShape('application')).toBe('sphere')
  })

  it('returns "cube" for product', () => {
    expect(docTypeToShape('product')).toBe('cube')
  })
})

describe('pointToSize', () => {
  it('higher value returns larger size', () => {
    expect(pointToSize('application', 900_000)).toBeGreaterThan(pointToSize('application', 150_000))
  })

  it('same dollar value gives same size regardless of doc_type', () => {
    expect(pointToSize('application', 3_000_000)).toBe(pointToSize('product', 3_000_000))
  })

  it('returns a positive number for zero value', () => {
    expect(pointToSize('application', 0)).toBeGreaterThan(0)
  })
})

describe('riskToHalo', () => {
  it('returns true for High risk', () => {
    expect(riskToHalo('High')).toBe(true)
  })

  it('returns true for Critical risk', () => {
    expect(riskToHalo('Critical')).toBe(true)
  })

  it('returns false for Medium risk', () => {
    expect(riskToHalo('Medium')).toBe(false)
  })

  it('returns false for Low risk', () => {
    expect(riskToHalo('Low')).toBe(false)
  })
})
