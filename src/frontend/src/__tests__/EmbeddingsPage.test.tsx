import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'
import EmbeddingsPage from '../pages/EmbeddingsPage'

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

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/embeddings${search}`]}>
      <Routes>
        <Route path="/embeddings" element={<EmbeddingsPage />} />
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

describe('EmbeddingsPage — secondary lines for retrieved-but-not-cited', () => {
  it('draws no lines after projection if the question has not been answered yet', async () => {
    const points = [makePoint('app1'), makePoint('app2')]
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(points) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: ['app1', 'app2'] }) })
    )

    renderPage('?q=risk')
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    // Query point is projected but no Ask has been clicked — no lines yet
    expect(screen.queryAllByTestId('scene-line')).toHaveLength(0)
  })

  it('draws a dim secondary line to a retrieved-but-not-cited point after the answer completes', async () => {
    installFakeEventSource()
    const points = [makePoint('app1'), makePoint('app2')]
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(points) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: ['app2'] }) })
    )

    renderPage('?q=risk')
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    fireEvent.click(screen.getByRole('button', { name: /ask/i }))

    // Simulate [DONE] with no citations — app2 is retrieved only
    lastES!.onmessage!({ data: '[DONE] {"app_sources":[],"product_sources":[],"context":[],"query":"risk"}' })

    const lines = await screen.findAllByTestId('scene-line')
    const secondaryLines = lines.filter(l => parseFloat(l.dataset.opacity ?? '1') < 0.4)
    expect(secondaryLines.length).toBeGreaterThan(0)
  })

  it('draws no lines while the answer is still streaming', async () => {
    installFakeEventSource()
    const points = [makePoint('app1'), makePoint('app2')]
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(points) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: ['app1', 'app2'] }) })
    )

    renderPage('?q=risk')
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    fireEvent.click(screen.getByRole('button', { name: /ask/i }))

    // Send a token but no [DONE] yet — still streaming
    lastES!.onmessage!({ data: JSON.stringify('partial') })
    await screen.findByText('partial')

    expect(screen.queryAllByTestId('scene-line')).toHaveLength(0)
  })

  it('does not draw a secondary line for points that are neither retrieved nor cited', async () => {
    installFakeEventSource()
    const points = [makePoint('app1'), makePoint('app2')]
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(points) })
      // projection retrieves only app1
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: ['app1'] }) })
    )

    renderPage('?q=risk')
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    fireEvent.click(screen.getByRole('button', { name: /ask/i }))
    lastES!.onmessage!({ data: '[DONE] {"app_sources":[],"product_sources":[],"context":[],"query":"risk"}' })

    const lines = await screen.findAllByTestId('scene-line')
    const secondaryLines = lines.filter(l => parseFloat(l.dataset.opacity ?? '1') < 0.4)
    // Only app1 is retrieved — app2 gets no line
    expect(secondaryLines.length).toBe(1)
  })

  it('derives cited IDs from streamed answer text, not from app_sources list', async () => {
    // When the API sends all retrieved sources (post-fix), only the one that appears
    // in the streamed answer text should get a primary line; the other should be secondary.
    installFakeEventSource()
    const namedPoints = [
      { ...makePoint('app1'), name: 'AuthService' },
      { ...makePoint('app2'), name: 'PaymentGateway' },
    ]
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(namedPoints) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: ['app1', 'app2'] }) })
    )

    renderPage('?q=risk')
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    fireEvent.click(screen.getByRole('button', { name: /ask/i }))

    // Stream the answer — only AuthService is mentioned
    lastES!.onmessage!({ data: JSON.stringify('AuthService') })
    lastES!.onmessage!({ data: JSON.stringify(' is relevant') })

    // [DONE] carries ALL retrieved sources (the new API contract)
    lastES!.onmessage!({
      data: '[DONE] {"app_sources":["AuthService","PaymentGateway"],"product_sources":[],"context":[],"query":"risk"}',
    })

    // Wait for the stable state: 1 primary (AuthService cited) + 1 secondary (PaymentGateway retrieved)
    await waitFor(() => {
      const lines = screen.getAllByTestId('scene-line')
      const primaryLines = lines.filter(l => parseFloat(l.dataset.opacity ?? '1') >= 0.4)
      const secondaryLines = lines.filter(l => parseFloat(l.dataset.opacity ?? '1') < 0.4)
      // AuthService → primary (cited); PaymentGateway → secondary (retrieved, not cited)
      expect(primaryLines).toHaveLength(1)
      expect(secondaryLines).toHaveLength(1)
    })
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

// ─── Helpers for EventSource simulation ───────────────────────────────────────

type FakeESInstance = {
  onmessage: ((e: { data: string }) => void) | null
  onerror: (() => void) | null
  close: () => void
  url: string
}

let lastES: FakeESInstance | null = null

function installFakeEventSource() {
  lastES = null
  function FakeES(this: FakeESInstance, url: string) {
    this.url = url
    this.onmessage = null
    this.onerror = null
    this.close = vi.fn()
    lastES = this
  }
  vi.stubGlobal('EventSource', FakeES)
}

// ─── Streaming tests ───────────────────────────────────────────────────────────

describe('EmbeddingsPage — Ask button fires /query/stream', () => {
  beforeEach(() => {
    installFakeEventSource()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve([makePoint('app1')]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: [] }) })
    )
  })

  it('opens an EventSource on /query/stream when Ask is clicked', async () => {
    renderPage('?q=governance')
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    fireEvent.click(screen.getByRole('button', { name: /ask/i }))
    expect(lastES).not.toBeNull()
    expect(lastES!.url).toContain('/query/stream')
    expect(lastES!.url).toContain('governance')
  })
})

describe('EmbeddingsPage — streaming answer display', () => {
  beforeEach(() => {
    installFakeEventSource()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve([makePoint('app1')]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: [] }) })
    )
  })

  it('accumulates streamed tokens into the answer display', async () => {
    renderPage('?q=governance')
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    fireEvent.click(screen.getByRole('button', { name: /ask/i }))

    lastES!.onmessage!({ data: JSON.stringify('Hello') })
    lastES!.onmessage!({ data: JSON.stringify(' world') })

    await screen.findByText('Hello world')
  })

  it('clears the answer when the query input is cleared', async () => {
    renderPage('?q=governance')
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    fireEvent.click(screen.getByRole('button', { name: /ask/i }))
    lastES!.onmessage!({ data: JSON.stringify('Some answer') })
    await screen.findByText('Some answer')

    // Clear the input
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })
    await waitFor(() => {
      expect(screen.queryByText('Some answer')).not.toBeInTheDocument()
    })
  })
})

describe('EmbeddingsPage — query change clears stale visuals', () => {
  it('clears the answer box immediately when a chip is selected', async () => {
    installFakeEventSource()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve([makePoint('app1')]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: [] }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [0, 1, 0], top_k_ids: [] }) })
    )

    renderPage('?q=governance')
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    fireEvent.click(screen.getByRole('button', { name: /ask/i }))
    lastES!.onmessage!({ data: JSON.stringify('Some answer') })
    await screen.findByTestId('answer-box')

    // Select a different chip — should clear the answer immediately
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Which applications have no named owner?' },
    })

    expect(screen.queryByTestId('answer-box')).not.toBeInTheDocument()
  })

  it('clears lines immediately when the user types a new query', async () => {
    installFakeEventSource()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve([makePoint('app1')]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: ['app1'] }) })
    )

    renderPage('?q=governance')
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    fireEvent.click(screen.getByRole('button', { name: /ask/i }))
    lastES!.onmessage!({ data: '[DONE] {"app_sources":["app1"],"product_sources":[],"context":[],"query":"governance"}' })

    await screen.findAllByTestId('scene-line')

    // Type into the input — lines should vanish without clicking Ask
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'something else' } })

    expect(screen.queryAllByTestId('scene-line')).toHaveLength(0)
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
