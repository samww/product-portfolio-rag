import { useState, useEffect } from 'react'
import type { SseTransport } from './ports'
import { QuerySession, type QuerySessionState } from './session'
import { eventSourceTransport } from './adapters'

const INITIAL: QuerySessionState = {
  answer: '',
  isStreaming: false,
  cited: [],
  context: [],
  rawPayload: null,
  error: null,
}

export function useQuerySession(transport?: SseTransport) {
  const [state, setState] = useState<QuerySessionState>(INITIAL)
  const [session] = useState(() => new QuerySession(transport ?? eventSourceTransport(), setState))

  useEffect(() => {
    return () => {
      session.cancel()
    }
  }, [session])

  return {
    ...state,
    ask: (q: string) => session.ask(q),
    cancel: () => session.cancel(),
    reset: () => session.reset(),
  }
}
