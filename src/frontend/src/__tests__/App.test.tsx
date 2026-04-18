import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

const CHIP_QUERY = 'Which applications have no named owner?'

function mockEventSource() {
  const urls: string[] = []

  function FakeEventSource(this: { onmessage: null; onerror: null; close: () => void }, url: string) {
    urls.push(url)
    this.onmessage = null
    this.onerror = null
    this.close = () => {}
  }

  vi.stubGlobal('EventSource', FakeEventSource)
  return { urls }
}

function mockFetch(data: object) {
  const fetchSpy = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(data),
  })
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('"Generate Risk Summary" button is visible in the header', () => {
    mockEventSource()
    render(<App />)
    expect(screen.getByRole('button', { name: /generate risk summary/i })).toBeInTheDocument()
  })

  it('clicking "Generate Risk Summary" calls POST /summarise', async () => {
    mockEventSource()
    const fetchSpy = mockFetch({
      overall_health: 'Healthy',
      executive_summary: 'All good.',
      critical_risks: [],
      governance_gaps: [],
      total_apps_reviewed: 5,
      total_arr_at_risk_000s: 0,
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /generate risk summary/i }))

    expect(fetchSpy).toHaveBeenCalledWith('/summarise', { method: 'POST' })
  })

  it('clicking a chip populates the query input', async () => {
    mockEventSource()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /show suggested queries/i }))
    await user.click(screen.getByText(CHIP_QUERY))

    expect(screen.getByRole('textbox')).toHaveValue(CHIP_QUERY)
  })

  it('pressing Enter submits the query', async () => {
    const { urls } = mockEventSource()
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('textbox'), 'test query{Enter}')

    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain(encodeURIComponent('test query'))
  })

  it('pressing Shift+Enter does not submit the query', async () => {
    const { urls } = mockEventSource()
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('textbox'), 'test query{Shift>}{Enter}{/Shift}')

    expect(urls).toHaveLength(0)
  })

  it('query input is a textarea (multi-line capable)', () => {
    mockEventSource()
    render(<App />)
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA')
  })

  it('clicking a chip does not submit — user must press Enter or Ask', async () => {
    const { urls } = mockEventSource()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /show suggested queries/i }))
    await user.click(screen.getByText(CHIP_QUERY))

    expect(urls).toHaveLength(0)
  })

  it('clicking a chip collapses the suggested queries section', async () => {
    mockEventSource()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /show suggested queries/i }))
    await user.click(screen.getByText(CHIP_QUERY))

    expect(screen.getByRole('button', { name: /show suggested queries/i })).toBeInTheDocument()
  })
})
