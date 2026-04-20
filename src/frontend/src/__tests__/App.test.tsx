import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

const CHIP_QUERY = 'Which applications have no named owner?'

function mockEventSource() {
  const urls: string[] = []
  let instance: { onmessage: ((e: { data: string }) => void) | null; onerror: null; close: () => void } | null = null

  function FakeEventSource(this: typeof instance & object, url: string) {
    urls.push(url)
    this.onmessage = null
    this.onerror = null
    this.close = () => {}
    instance = this
  }

  vi.stubGlobal('EventSource', FakeEventSource)
  return {
    urls,
    emit(data: string) { instance?.onmessage?.({ data }) },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('App', () => {
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

  it('clicking a chip clears the previous response', async () => {
    const es = mockEventSource()
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('textbox'), 'test query{Enter}')
    act(() => { es.emit(JSON.stringify('Some answer text')) })
    act(() => { es.emit('[DONE] {"app_sources":[],"product_sources":[],"context":[],"query":"test query"}') })

    expect(screen.getByText('Some answer text')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show suggested queries/i }))
    await user.click(screen.getByText(CHIP_QUERY))

    expect(screen.queryByText('Some answer text')).not.toBeInTheDocument()
  })

  it('clicking a chip scrolls to the top of the page', async () => {
    mockEventSource()
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /show suggested queries/i }))
    await user.click(screen.getByText(CHIP_QUERY))

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
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
