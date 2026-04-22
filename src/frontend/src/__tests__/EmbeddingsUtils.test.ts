import { describe, it, expect } from 'vitest'
import { divisionToColor, docTypeToShape, pointToSize, mergeTopKIntoPoints, buildIsolationFilter } from '../pages/EmbeddingsPage.utils'
import type { EmbeddingPoint, EmbeddingPointWithTopK } from '../pages/EmbeddingsPage.utils'

const makePoint = (id: string): EmbeddingPoint => ({
  id,
  doc_type: 'application',
  division: 'Finance',
  name: id,  // use id as name so citedIds can match by name in tests
  summary: 'Summary',
  risk_rating: 'Low',
  cost_000s: 1000,
  arr_000s: 0,
  projected_xyz: [0, 0, 0],
})

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

describe('mergeTopKIntoPoints', () => {
  it('marks points whose IDs are in citedIds as cited true', () => {
    const points = [makePoint('a'), makePoint('b'), makePoint('c')]
    const result = mergeTopKIntoPoints(points, ['a', 'c'])
    expect(result.find(p => p.id === 'a')?.cited).toBe(true)
    expect(result.find(p => p.id === 'c')?.cited).toBe(true)
  })

  it('marks points not in citedIds as cited false', () => {
    const points = [makePoint('a'), makePoint('b')]
    const result = mergeTopKIntoPoints(points, ['a'])
    expect(result.find(p => p.id === 'b')?.cited).toBe(false)
  })

  it('marks all points as cited false when citedIds is empty', () => {
    const points = [makePoint('x'), makePoint('y')]
    const result = mergeTopKIntoPoints(points, [])
    expect(result.every(p => p.cited === false)).toBe(true)
  })
})

describe('buildIsolationFilter', () => {
  const pts: EmbeddingPointWithTopK[] = [
    { ...makePoint('a'), cited: true },
    { ...makePoint('b'), cited: false },
    { ...makePoint('c'), cited: true },
  ]

  it('passes all points when selectedId is null', () => {
    const filter = buildIsolationFilter(null, pts)
    expect(pts.every(filter)).toBe(true)
  })

  it('passes only the selected point and cited points when selectedId is set', () => {
    const filter = buildIsolationFilter('b', pts)
    expect(filter(pts[0])).toBe(true)   // a — cited
    expect(filter(pts[1])).toBe(true)   // b — selected
    expect(filter(pts[2])).toBe(true)   // c — cited
  })

  it('fails non-cited non-selected points when selectedId is set', () => {
    const ptsNonCited: EmbeddingPointWithTopK[] = [
      { ...makePoint('a'), cited: false },
      { ...makePoint('b'), cited: false },
    ]
    const filter = buildIsolationFilter('a', ptsNonCited)
    expect(filter(ptsNonCited[0])).toBe(true)   // a — selected
    expect(filter(ptsNonCited[1])).toBe(false)  // b — not selected, not cited
  })
})

