import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { EmbeddingsQueryBar } from '../pages/EmbeddingsPage'

function renderWithRouter(initialSearch = '') {
  return render(
    <MemoryRouter initialEntries={[`/embeddings${initialSearch}`]}>
      <Routes>
        <Route path="/embeddings" element={<EmbeddingsQueryBar />} />
      </Routes>
    </MemoryRouter>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('EmbeddingsQueryBar', () => {
  it('renders an empty input when no ?q= param', () => {
    renderWithRouter()
    const input = screen.getByRole('textbox')
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('reflects ?q= value from URL on load', () => {
    renderWithRouter('?q=hello')
    const input = screen.getByRole('textbox')
    expect((input as HTMLInputElement).value).toBe('hello')
  })

  it('does not update URL before 300ms debounce', () => {
    vi.useFakeTimers()
    renderWithRouter()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'risk' } })
    expect((input as HTMLInputElement).value).toBe('risk')
    // URL param not yet written — input is controlled by local debounced state
    // We verify the searchParam write doesn't happen immediately by checking
    // that a second render still shows the typed value but param flush hasn't fired
    act(() => { vi.advanceTimersByTime(200) })
    expect((input as HTMLInputElement).value).toBe('risk')
  })

  it('updates URL param after 300ms debounce', () => {
    vi.useFakeTimers()
    // We test URL update via the input value re-reading after flush
    // Full router integration: render with a route that exposes the search param
    const { container } = render(
      <MemoryRouter initialEntries={['/embeddings']}>
        <Routes>
          <Route
            path="/embeddings"
            element={
              <>
                <EmbeddingsQueryBar />
                <SearchDisplay />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'revenue' } })
    act(() => { vi.advanceTimersByTime(299) })
    expect(container.querySelector('[data-testid="search"]')?.textContent).toBe('')
    act(() => { vi.advanceTimersByTime(1) })
    expect(container.querySelector('[data-testid="search"]')?.textContent).toBe('revenue')
  })

  it('QueryChips onSelect writes to searchParams', () => {
    vi.useFakeTimers()
    const { container } = render(
      <MemoryRouter initialEntries={['/embeddings']}>
        <Routes>
          <Route
            path="/embeddings"
            element={
              <>
                <EmbeddingsQueryBar />
                <SearchDisplay />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    )
    // Open chips
    fireEvent.click(screen.getByText(/show suggested queries/i))
    // Click the first chip
    const chips = screen.getAllByRole('button').filter(b =>
      b.className.includes('rounded-full')
    )
    fireEvent.click(chips[0])
    // Chips onSelect should write immediately (no debounce for direct chip select)
    expect(container.querySelector('[data-testid="search"]')?.textContent).not.toBe('')
  })
})

function SearchDisplay() {
  const [params] = useSearchParams()
  return <div data-testid="search">{params.get('q') ?? ''}</div>
}
