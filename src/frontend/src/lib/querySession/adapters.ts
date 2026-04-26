import type { SseEvent, SseTransport } from './ports'

export class InMemoryTransport implements SseTransport {
  lastUrl: string | null = null
  closed = false
  private _onEvent: ((e: SseEvent) => void) | null = null

  open(url: string, onEvent: (e: SseEvent) => void): void {
    this.lastUrl = url
    this.closed = false
    this._onEvent = onEvent
  }

  close(): void {
    this.closed = true
    this._onEvent = null
  }

  emitToken(value: string): void {
    this._onEvent?.({ kind: 'token', value })
  }

  emitDone(payload: import('./ports').DonePayload): void {
    this._onEvent?.({ kind: 'done', payload })
  }

  emitError(cause?: unknown): void {
    this._onEvent?.({ kind: 'error', cause })
  }
}

export function eventSourceTransport(): SseTransport {
  let es: EventSource | null = null
  return {
    open(url, onEvent) {
      es = new EventSource(url)
      es.onmessage = (e) => {
        const data: string = e.data
        if (data.startsWith('[DONE]')) {
          es!.close()
          const json = data.slice('[DONE] '.length)
          try {
            const payload = JSON.parse(json) as import('./ports').DonePayload
            onEvent({ kind: 'done', payload })
          } catch (cause) {
            onEvent({ kind: 'error', cause })
          }
        } else {
          try {
            onEvent({ kind: 'token', value: JSON.parse(data) as string })
          } catch {
            // malformed token — skip
          }
        }
      }
      es.onerror = (cause) => {
        es!.close()
        onEvent({ kind: 'error', cause })
      }
    },
    close() {
      es?.close()
      es = null
    },
  }
}
