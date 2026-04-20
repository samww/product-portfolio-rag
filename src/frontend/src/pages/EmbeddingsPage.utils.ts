const DIVISION_COLORS: Record<string, string> = {
  Analytics: '#6366f1',
  'Client Services': '#10b981',
  'Data Collection': '#f59e0b',
  Finance: '#3b82f6',
  HR: '#ec4899',
  'Platform Engineering': '#f97316',
}

const FALLBACK_COLOR = '#94a3b8'

export function divisionToColor(division: string): string {
  return DIVISION_COLORS[division] ?? FALLBACK_COLOR
}

export function docTypeToShape(doc_type: string): 'sphere' | 'cube' {
  return doc_type === 'product' ? 'cube' : 'sphere'
}

const MIN_SIZE = 0.010
const MAX_SIZE = 0.032
const SCALE_MAX = 7_000_000  // $7M cap covers full data range

export function pointToSize(_doc_type: string, value: number): number {
  const t = Math.min(Math.max(value, 0) / SCALE_MAX, 1)
  return MIN_SIZE + t * (MAX_SIZE - MIN_SIZE)
}

export function riskToHalo(risk_rating: string): boolean {
  return risk_rating === 'High' || risk_rating === 'Critical'
}
