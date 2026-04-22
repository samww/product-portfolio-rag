import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'
import EmbeddingsPage from '../pages/EmbeddingsPage'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useThree: () => ({
    scene: { background: null },
    camera: { position: { set: vi.fn() }, lookAt: vi.fn(), fov: 60 },
  }),
}))

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Html: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Line: () => null,
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

describe('EmbeddingsPage projection fetch', () => {
  it('sends top_k=8 when posting to /embeddings/project', async () => {
    const points = [makePoint('app1')]
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(points) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ projected_xyz: [1, 0, 0], top_k_ids: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    renderPage('?q=risk')
    await screen.findByRole('heading', { name: /^Query$/i, level: 3 })

    const projectCall = fetchMock.mock.calls.find(([url]: [string]) => url === '/embeddings/project')
    expect(projectCall).toBeDefined()
    const body = JSON.parse(projectCall[1].body)
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
