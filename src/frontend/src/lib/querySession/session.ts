import type { SseTransport, CitedSource, DonePayload } from './ports'
import { filterCitations } from './filter'

export interface QuerySessionState {
  answer: string
  isStreaming: boolean
  cited: CitedSource[]
  context: string[]
  rawPayload: DonePayload | null
  error: unknown | null
}

const INITIAL_STATE: QuerySessionState = {
  answer: '',
  isStreaming: false,
  cited: [],
  context: [],
  rawPayload: null,
  error: null,
}

export class QuerySession {
  private _state: QuerySessionState = { ...INITIAL_STATE }
  private _transport: SseTransport
  private _onChange: (s: QuerySessionState) => void

  constructor(transport: SseTransport, onChange: (s: QuerySessionState) => void) {
    this._transport = transport
    this._onChange = onChange
  }

  ask(query: string): void {
    this._transport.close()
    this._state = { ...INITIAL_STATE, isStreaming: true }
    this._onChange(this._state)

    const url = `/query/stream?query=${encodeURIComponent(query)}`
    this._transport.open(url, (event) => {
      if (event.kind === 'token') {
        this._state = { ...this._state, answer: this._state.answer + event.value }
        this._onChange(this._state)
      } else if (event.kind === 'done') {
        const { app_sources, product_sources, context } = event.payload
        const candidates: CitedSource[] = [
          ...app_sources.map((name) => ({ name, kind: 'app' as const })),
          ...product_sources.map((name) => ({ name, kind: 'product' as const })),
        ]
        this._state = {
          ...this._state,
          isStreaming: false,
          cited: filterCitations(this._state.answer, candidates),
          context,
          rawPayload: event.payload,
        }
        this._onChange(this._state)
      } else {
        this._state = { ...this._state, isStreaming: false, error: event.cause ?? true }
        this._onChange(this._state)
      }
    })
  }

  cancel(): void {
    if (!this._state.isStreaming) return
    this._transport.close()
    this._state = { ...this._state, isStreaming: false }
    this._onChange(this._state)
  }

  reset(): void {
    this._transport.close()
    this._state = { ...INITIAL_STATE }
    this._onChange(this._state)
  }

  snapshot(): QuerySessionState {
    return this._state
  }
}
