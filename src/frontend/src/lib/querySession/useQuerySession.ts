import { useState, useEffect, useRef } from 'react'
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
  const sessionRef = useRef<QuerySession | null>(null)

  if (!sessionRef.current) {
    sessionRef.current = new QuerySession(transport ?? eventSourceTransport(), setState)
  }

  useEffect(() => {
    return () => {
      sessionRef.current?.cancel()
    }
  }, [])

  const session = sessionRef.current
  return {
    ...state,
    ask: (q: string) => session.ask(q),
    cancel: () => session.cancel(),
    reset: () => session.reset(),
  }
}
