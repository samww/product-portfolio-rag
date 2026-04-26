// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { filterCitations } from './filter'
import { QuerySession } from './session'
import { InMemoryTransport } from './adapters'

describe('filterCitations', () => {
  it('returns only candidates whose name appears in the answer, tagged by kind', () => {
    const answer = 'AuthService handles authentication. CoreProduct is mentioned.'
    const candidates = [
      { name: 'AuthService', kind: 'app' as const },
      { name: 'PaymentGateway', kind: 'app' as const },
      { name: 'CoreProduct', kind: 'product' as const },
    ]
    expect(filterCitations(answer, candidates)).toEqual([
      { name: 'AuthService', kind: 'app' },
      { name: 'CoreProduct', kind: 'product' },
    ])
  })

  it('returns empty array when no candidates match', () => {
    expect(filterCitations('nothing relevant', [
      { name: 'AuthService', kind: 'app' as const },
    ])).toEqual([])
  })
})

describe('QuerySession', () => {
  it('ask() opens the transport with a URL-encoded URL and sets isStreaming true', () => {
    const transport = new InMemoryTransport()
    const onChange = vi.fn()
    const session = new QuerySession(transport, onChange)

    session.ask('what is the risk?')

    expect(transport.lastUrl).toBe('/query/stream?query=what%20is%20the%20risk%3F')
    expect(session.snapshot().isStreaming).toBe(true)
  })

  it('accumulates tokens in order into answer', () => {
    const transport = new InMemoryTransport()
    const session = new QuerySession(transport, vi.fn())

    session.ask('q')
    transport.emitToken('Hello')
    transport.emitToken(', ')
    transport.emitToken('world')

    expect(session.snapshot().answer).toBe('Hello, world')
    expect(session.snapshot().isStreaming).toBe(true)
  })

  it('done event sets isStreaming false, populates cited (filtered+tagged), context and rawPayload', () => {
    const transport = new InMemoryTransport()
    const session = new QuerySession(transport, vi.fn())

    session.ask('q')
    transport.emitToken('AuthService is great')
    transport.emitDone({
      app_sources: ['AuthService', 'PaymentGateway'],
      product_sources: ['CoreProduct'],
      context: ['chunk1', 'chunk2'],
      query: 'q',
    })

    const state = session.snapshot()
    expect(state.isStreaming).toBe(false)
    expect(state.cited).toEqual([{ name: 'AuthService', kind: 'app' }])
    expect(state.context).toEqual(['chunk1', 'chunk2'])
    expect(state.rawPayload).toEqual({
      app_sources: ['AuthService', 'PaymentGateway'],
      product_sources: ['CoreProduct'],
      context: ['chunk1', 'chunk2'],
      query: 'q',
    })
  })

  it('re-entrant ask() closes the prior transport and resets state before opening a new stream', () => {
    const transport = new InMemoryTransport()
    const session = new QuerySession(transport, vi.fn())

    session.ask('first')
    transport.emitToken('partial answer')

    session.ask('second')

    expect(transport.lastUrl).toContain('second')
    const state = session.snapshot()
    expect(state.answer).toBe('')
    expect(state.isStreaming).toBe(true)
  })

  it('cancel() sets isStreaming false and closes transport; second cancel() is a no-op', () => {
    const transport = new InMemoryTransport()
    const onChange = vi.fn()
    const session = new QuerySession(transport, onChange)

    session.ask('q')
    transport.emitToken('some text')

    session.cancel()
    expect(session.snapshot().isStreaming).toBe(false)
    expect(transport.closed).toBe(true)

    const callCountAfterFirstCancel = onChange.mock.calls.length
    session.cancel()
    expect(onChange.mock.calls.length).toBe(callCountAfterFirstCancel)
  })

  it('error event ends streaming without throwing and populates error field', () => {
    const transport = new InMemoryTransport()
    const session = new QuerySession(transport, vi.fn())

    session.ask('q')
    expect(() => transport.emitError(new Error('network failure'))).not.toThrow()

    const state = session.snapshot()
    expect(state.isStreaming).toBe(false)
    expect(state.error).toBeInstanceOf(Error)
  })

  it('malformed [DONE] payload surfaces as error state, does not crash the session', () => {
    const transport = new InMemoryTransport()
    const session = new QuerySession(transport, vi.fn())

    session.ask('q')
    transport.emitToken('some answer')
    // emitError simulates what eventSourceTransport does when JSON.parse fails
    transport.emitError(new SyntaxError('bad json'))

    const state = session.snapshot()
    expect(state.isStreaming).toBe(false)
    expect(state.error).toBeInstanceOf(SyntaxError)
    expect(state.answer).toBe('some answer')
  })
})
