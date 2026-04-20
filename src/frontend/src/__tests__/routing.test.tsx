import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from '../App'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe('routing', () => {
  it('/ mounts the query textarea', () => {
    renderAt('/')
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('/summary mounts the summary page', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({
      overall_health: 'Healthy', executive_summary: '', critical_risks: [],
      governance_gaps: [], total_apps_reviewed: 0, total_arr_at_risk_000s: 0,
    }) }))
    renderAt('/summary')
    expect(screen.getByRole('button', { name: /generate risk summary/i })).toBeInTheDocument()
  })

  it('/ does not render the summary report table', () => {
    renderAt('/')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('navbar contains a link to /summary', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: /risk summary/i })).toHaveAttribute('href', '/summary')
  })

  it('navbar is present on /', () => {
    renderAt('/')
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('navbar is present on /summary', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({
      overall_health: 'Healthy', executive_summary: '', critical_risks: [],
      governance_gaps: [], total_apps_reviewed: 0, total_arr_at_risk_000s: 0,
    }) }))
    renderAt('/summary')
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})
