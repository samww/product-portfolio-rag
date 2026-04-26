import type { CitedSource } from './ports'

export function filterCitations(answer: string, candidates: CitedSource[]): CitedSource[] {
  return candidates.filter((c) => answer.includes(c.name))
}
