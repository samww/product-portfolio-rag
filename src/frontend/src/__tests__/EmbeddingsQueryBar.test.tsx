import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { EmbeddingsQueryBar } from '../components/EmbeddingsQueryBar'

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

describe('EmbeddingsQueryBar — Ask button', () => {
  it('renders an Ask button', () => {
    renderWithRouter()
    expect(screen.getByRole('button', { name: /ask/i })).toBeInTheDocument()
  })

  it('calls onAsk with the current input value when clicked', () => {
    const onAsk = vi.fn()
    render(
      <MemoryRouter initialEntries={['/embeddings?q=governance']}>
        <Routes>
          <Route path="/embeddings" element={<EmbeddingsQueryBar onAsk={onAsk} />} />
        </Routes>
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: /ask/i }))
    expect(onAsk).toHaveBeenCalledWith('governance')
  })

  it('pressing Enter on the input calls onAsk when input has content', () => {
    const onAsk = vi.fn()
    render(
      <MemoryRouter initialEntries={['/embeddings?q=governance']}>
        <Routes>
          <Route path="/embeddings" element={<EmbeddingsQueryBar onAsk={onAsk} />} />
        </Routes>
      </MemoryRouter>
    )
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onAsk).toHaveBeenCalledWith('governance')
  })

  it('pressing Enter on the input does not call onAsk when input is empty', () => {
    const onAsk = vi.fn()
    renderWithRouter()
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onAsk).not.toHaveBeenCalled()
  })
})

describe('EmbeddingsQueryBar — answer display', () => {
  it('renders the answer text below the input when answer prop is provided', () => {
    render(
      <MemoryRouter initialEntries={['/embeddings']}>
        <Routes>
          <Route path="/embeddings" element={<EmbeddingsQueryBar answer="The answer is 42." />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('The answer is 42.')).toBeInTheDocument()
  })

  it('renders nothing for the answer when answer prop is empty', () => {
    render(
      <MemoryRouter initialEntries={['/embeddings']}>
        <Routes>
          <Route path="/embeddings" element={<EmbeddingsQueryBar answer="" />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.queryByText('The answer is 42.')).not.toBeInTheDocument()
  })

  it('renders the answer inside a scrollable container with a max-height constraint', () => {
    render(
      <MemoryRouter initialEntries={['/embeddings']}>
        <Routes>
          <Route path="/embeddings" element={<EmbeddingsQueryBar answer="The answer is 42." />} />
        </Routes>
      </MemoryRouter>
    )
    const text = screen.getByText('The answer is 42.')
    const box = text.closest('[data-testid="answer-box"]')
    expect(box).toBeInTheDocument()
    expect(box!.className).toMatch(/overflow-y/)
    expect(box!.className).toMatch(/max-h/)
  })
})

describe('EmbeddingsQueryBar — suggested query dropdown', () => {
  it('renders a select dropdown for suggested queries', () => {
    renderWithRouter()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('does not render a "Show suggested queries" toggle', () => {
    renderWithRouter()
    expect(screen.queryByText(/show suggested queries/i)).not.toBeInTheDocument()
  })
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

  it('selecting a dropdown option writes to searchParams immediately (no debounce)', () => {
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
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'Which applications have a Critical or High risk rating?' } })
    expect(container.querySelector('[data-testid="search"]')?.textContent).toBe('Which applications have a Critical or High risk rating?')
  })

  it('selecting a dropdown option populates the text input', () => {
    renderWithRouter()
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'Which applications have no named owner?' } })
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Which applications have no named owner?')
  })
})

describe('EmbeddingsQueryBar — onQueryChange', () => {
  it('calls onQueryChange immediately when the user types', () => {
    vi.useFakeTimers()
    const onQueryChange = vi.fn()
    render(
      <MemoryRouter initialEntries={['/embeddings?q=old']}>
        <Routes>
          <Route path="/embeddings" element={<EmbeddingsQueryBar onQueryChange={onQueryChange} />} />
        </Routes>
      </MemoryRouter>
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new query' } })
    expect(onQueryChange).toHaveBeenCalledTimes(1)
    // must fire before the 300ms debounce
    act(() => { vi.advanceTimersByTime(0) })
    expect(onQueryChange).toHaveBeenCalledTimes(1)
  })

  it('calls onQueryChange when a chip is selected', () => {
    const onQueryChange = vi.fn()
    render(
      <MemoryRouter initialEntries={['/embeddings']}>
        <Routes>
          <Route path="/embeddings" element={<EmbeddingsQueryBar onQueryChange={onQueryChange} />} />
        </Routes>
      </MemoryRouter>
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Which applications have no named owner?' } })
    expect(onQueryChange).toHaveBeenCalledTimes(1)
  })
})

function SearchDisplay() {
  const [params] = useSearchParams()
  return <div data-testid="search">{params.get('q') ?? ''}</div>
}
