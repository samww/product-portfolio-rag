export type SseEvent =
  | { kind: 'token'; value: string }
  | { kind: 'done'; payload: DonePayload }
  | { kind: 'error'; cause?: unknown }

export interface DonePayload {
  app_sources: string[]
  product_sources: string[]
  context: string[]
  query: string
}

export interface CitedSource {
  name: string
  kind: 'app' | 'product'
}

export interface SseTransport {
  open(url: string, onEvent: (e: SseEvent) => void): void
  close(): void
}
