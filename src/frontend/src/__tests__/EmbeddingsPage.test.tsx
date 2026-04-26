import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'
import EmbeddingsPage from '../pages/EmbeddingsPage'
import { InMemoryTransport } from '../lib/querySession'
import type { SseTransport } from '../lib/querySession'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, onPointerMissed }: { children: React.ReactNode; onPointerMissed?: () => void }) => (
    <div data-testid="canvas">
      {children}
      <button data-testid="canvas-missed" onClick={onPointerMissed} />
    </div>
  ),
  useThree: () => ({
    scene: { background: null },
    camera: { position: { set: vi.fn() }, lookAt: vi.fn(), fov: 60 },
  }),
}))

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Html: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Line: ({ color, opacity }: { color?: string; opacity?: number }) => (
    <div data-testid="scene-line" data-color={color} data-opacity={opacity} />
  ),
}))

vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: () => null,
  Bloom: () => null,
}))

vi.mock('three', () => ({
  Color: class {},
  PerspectiveCamera: class {},
  BackSide: 0,
  AxesHelper: class {},
}))

const makePoint = (id: string) => ({
  id,
  doc_type: 'application',
  division: 'Finance',
  name: 'Test App',
  summary: 'Summary',
  risk_rating: 'High',
  cost_000s: 1_000_000,
  arr_000s: 0,
  projected_xyz: [0.1, 0.2, 0.3],
})

function renderPage(search = '', transport?: SseTransport) {
  return render(
    <MemoryRouter initialEntries={[`/embeddings${search}`]}>
      <Routes>
        <Route path="/embeddings" element={<EmbeddingsPage transport={transport} />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('EmbeddingsPage mobile scrollability', () => {
  it('page root does not carry bare overflow-hidden (would lock mobile scroll)', () => {
    const { container } = renderPage()
    const root = container.firstChild as HTMLElement
    expect(root.className.split(' ')).not.toContain('overflow-hidden')
  })

  it('canvas container has an explicit viewport-relative height (not only min-height) so r3f height:100% resolves', () => {
    const { container } = renderPage()
    const root = container.firstChild as HTMLElement
    const inner = root.children[1] as HTMLElement
    const canvasContainer = inner.children[0] as HTMLElement
    const classes = canvasContainer.className.split(' ')
    // Must be an explicit h-[…vh] class, not just min-h-[…vh].
    // Without an explicit height the CSS containing block is "auto" and
    // r3f's internal <canvas height:100%> resolves to ~0px.
    expect(classes.some(cls => /^h-\[.*vh\]$/.test(cls))).toBe(true)
  })

  it('inner layout container does not carry bare overflow-hidden', () => {
    const { container } = renderPage()
    const root = container.firstChild as HTMLElement
    // second child of root is the flex row/col that wraps canvas + teaching panel
    const inner = root.children[1] as HTMLElement
    expect(inner.className.split(' ')).not.toContain('overflow-hidden')
  })
})

describe('EmbeddingsPage projection fetch', () => {
  it('sends top_k=8 when posting to /embeddings/project', async () => {
    const points = [makePoint('app1')]
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(points) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    renderPage('?q=risk')
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    const projectCall = fetchMock.mock.calls.find((call) => call[0] === '/embeddings/project')
    expect(projectCall).toBeDefined()
    const body = JSON.parse(projectCall![1].body)
    expect(body.top_k).toBe(8)
  })
})

describe('EmbeddingsPage teaching panel', () => {
  it('does not render a "Risk halo" section', async () => {
    renderPage()
    await screen.findByRole('heading', { name: /Embedding space/i })
    expect(screen.queryByText(/risk halo/i)).not.toBeInTheDocument()
  })

  it('does not render a "Distance lines" toggle when top-k results are present', async () => {
    const points = [makePoint('app1')]
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(points) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: [] }) })
    )
    renderPage('?q=risk')
    // The "Query" aside section only renders once queryXyz is set (second fetch resolved)
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })
    expect(screen.queryByRole('checkbox', { name: /distance lines/i })).not.toBeInTheDocument()
  })
})

describe('EmbeddingsPage — onPointerMissed dismisses pinned tooltip', () => {
  it('clears the pinned tooltip when the canvas fires onPointerMissed', async () => {
    const points = [makePoint('app1')]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(points) }))

    const { container } = renderPage()

    // Wait for point data to load (footer appears)
    await screen.findByText(/records/i)

    // Pin a point by clicking its mesh element
    const mesh = container.querySelector('mesh')
    expect(mesh).not.toBeNull()
    fireEvent.click(mesh!)

    // Tooltip should now be visible
    expect(screen.getByText('Test App')).toBeInTheDocument()

    // Simulate clicking empty canvas space
    fireEvent.click(screen.getByTestId('canvas-missed'))

    // Tooltip should be dismissed
    expect(screen.queryByText('Test App')).not.toBeInTheDocument()
  })
})

// ─── useQuerySession integration (InMemoryTransport) ─────────────────────────

describe('EmbeddingsPage — transport-driven streaming', () => {
  it('streams tokens from transport into the answer box', async () => {
    const transport = new InMemoryTransport()
    const points = [makePoint('app1')]
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(points) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: [] }) })
    )

    renderPage('?q=governance', transport)
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    fireEvent.click(screen.getByRole('button', { name: /ask/i }))

    act(() => { transport.emitToken('Hello') })
    act(() => { transport.emitToken(' world') })

    await screen.findByTestId('answer-box')
    expect(screen.getByTestId('answer-box')).toHaveTextContent('Hello world')
  })

  it('wires cited names from the session into primary scene lines', async () => {
    const transport = new InMemoryTransport()
    const namedPoints = [
      { ...makePoint('app1'), name: 'AuthService' },
      { ...makePoint('app2'), name: 'PaymentGateway' },
    ]
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(namedPoints) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: ['app1', 'app2'] }) })
    )

    renderPage('?q=risk', transport)
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    fireEvent.click(screen.getByRole('button', { name: /ask/i }))
    act(() => { transport.emitToken('AuthService is the culprit') })
    act(() => {
      transport.emitDone({
        app_sources: ['AuthService', 'PaymentGateway'],
        product_sources: [],
        context: [],
        query: 'risk',
      })
    })

    await waitFor(() => {
      const lines = screen.getAllByTestId('scene-line')
      const primary = lines.filter(l => parseFloat(l.dataset.opacity ?? '1') >= 0.4)
      const secondary = lines.filter(l => parseFloat(l.dataset.opacity ?? '1') < 0.4)
      expect(primary).toHaveLength(1)   // AuthService cited in answer
      expect(secondary).toHaveLength(1) // PaymentGateway retrieved, not cited
    })
  })

  it('shows no lines while streaming and primary lines after stream completes', async () => {
    const transport = new InMemoryTransport()
    const points = [{ ...makePoint('app1'), name: 'AuthService' }]
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(points) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: ['app1'] }) })
    )

    renderPage('?q=risk', transport)
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    fireEvent.click(screen.getByRole('button', { name: /ask/i }))
    act(() => { transport.emitToken('AuthService') })
    await screen.findByText('AuthService')

    expect(screen.queryAllByTestId('scene-line')).toHaveLength(0)

    act(() => {
      transport.emitDone({ app_sources: ['AuthService'], product_sources: [], context: [], query: 'risk' })
    })

    await waitFor(() => expect(screen.getAllByTestId('scene-line').length).toBeGreaterThan(0))
  })

  it('clears the answer when the session is reset via query change', async () => {
    const transport = new InMemoryTransport()
    const points = [makePoint('app1')]
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(points) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: [] }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [0, 1, 0], top_k_ids: [] }) })
    )

    renderPage('?q=governance', transport)
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    fireEvent.click(screen.getByRole('button', { name: /ask/i }))
    act(() => { transport.emitToken('Some answer') })
    await screen.findByTestId('answer-box')

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Which applications have no named owner?' },
    })

    expect(screen.queryByTestId('answer-box')).not.toBeInTheDocument()
  })
})
