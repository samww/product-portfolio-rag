import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'

function FakeEventSource(this: { onmessage: null; onerror: null; close: () => void }) {
  this.onmessage = null
  this.onerror = null
  this.close = vi.fn()
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  )
}

describe('HomePage', () => {
  it('renders the ask button and textarea', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /ask/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/ask anything/i)).toBeInTheDocument()
  })

  it('button shows Streaming while a query is in flight', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    renderPage()

    const textarea = screen.getByPlaceholderText(/ask anything/i)
    fireEvent.change(textarea, { target: { value: 'what is the risk?' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ask/i }))
    })

    expect(screen.getByRole('button', { name: /streaming/i })).toBeInTheDocument()
  })
})
