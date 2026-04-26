import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useQuerySession } from '../lib/querySession'
import { InMemoryTransport } from '../lib/querySession'

describe('useQuerySession', () => {
  it('unmounting during a stream closes the transport', () => {
    const transport = new InMemoryTransport()
    const { result, unmount } = renderHook(() => useQuerySession(transport))

    act(() => {
      result.current.ask('what is the risk?')
    })

    expect(result.current.isStreaming).toBe(true)

    unmount()

    expect(transport.closed).toBe(true)
  })
})
