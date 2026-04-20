import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SummaryPage } from '../pages/SummaryPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <SummaryPage />
    </MemoryRouter>
  )
}

function mockFetch(data: object) {
  const spy = vi.fn().mockResolvedValue({ json: () => Promise.resolve(data) })
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SummaryPage', () => {
  it('"Generate Risk Summary" button is visible', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /generate risk summary/i })).toBeInTheDocument()
  })

  it('"Generate Risk Summary" button is inside main content, not the page header', () => {
    renderPage()
    const main = document.querySelector('main')!
    expect(main).not.toBeNull()
    expect(main).toContainElement(screen.getByRole('button', { name: /generate risk summary/i }))
    const header = document.querySelector('header')!
    expect(header).not.toContainElement(screen.getByRole('button', { name: /generate risk summary/i }))
  })

  it('clicking "Generate Risk Summary" calls POST /summarise', async () => {
    const fetchSpy = mockFetch({
      overall_health: 'Healthy',
      executive_summary: 'All good.',
      critical_risks: [],
      governance_gaps: [],
      total_apps_reviewed: 5,
      total_arr_at_risk_000s: 0,
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /generate risk summary/i }))

    expect(fetchSpy).toHaveBeenCalledWith('/summarise', { method: 'POST' })
  })
})
