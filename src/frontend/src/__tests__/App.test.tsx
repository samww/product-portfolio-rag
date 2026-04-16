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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('clicking a chip populates the query input', async () => {
    mockEventSource()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByText(CHIP_QUERY))

    expect(screen.getByRole('textbox')).toHaveValue(CHIP_QUERY)
  })

  it('clicking a chip triggers submission', async () => {
    const { urls } = mockEventSource()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByText(CHIP_QUERY))

    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain(encodeURIComponent(CHIP_QUERY))
  })
})
