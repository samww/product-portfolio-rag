import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SummaryReport } from '../components/SummaryReport'
import type { SummaryReportData } from '../components/SummaryReport'

const baseReport: SummaryReportData = {
  overall_health: 'Healthy',
  executive_summary: 'Portfolio is in good shape.',
  critical_risks: [],
  governance_gaps: [],
  total_apps_reviewed: 10,
  total_arr_at_risk_000s: 0,
}

const riskFinding: import('../components/SummaryReport').RiskFinding = {
  application: 'AuthService',
  risk_rating: 'Critical',
  issue: 'No DR plan',
  revenue_at_risk_000s: 1200,
  recommended_action: 'Implement DR runbook',
  priority: 'Immediate',
  product_exposures: [],
}

const governanceGap: import('../components/SummaryReport').GovernanceGap = {
  application: 'ContractVault',
  issue: 'No data retention policy',
  recommended_action: 'Define retention schedule',
}

describe('SummaryReport — health badge', () => {
  it('renders "Healthy" badge with green colour class', () => {
    render(<SummaryReport report={{ ...baseReport, overall_health: 'Healthy' }} />)
    const badge = screen.getByText('Healthy')
    expect(badge.className).toMatch(/green/)
  })

  it('renders "At Risk" badge with amber colour class', () => {
    render(<SummaryReport report={{ ...baseReport, overall_health: 'At Risk' }} />)
    const badge = screen.getByText('At Risk')
    expect(badge.className).toMatch(/amber/)
  })

  it('renders "Critical" badge with red colour class', () => {
    render(<SummaryReport report={{ ...baseReport, overall_health: 'Critical' }} />)
    const badge = screen.getByText('Critical')
    expect(badge.className).toMatch(/red/)
  })
})

describe('SummaryReport — critical risks table', () => {
  it('renders a row for each risk finding', () => {
    const second = { ...riskFinding, application: 'ForecastTool', priority: 'High' }
    render(<SummaryReport report={{ ...baseReport, critical_risks: [riskFinding, second] }} />)

    expect(screen.getByText('AuthService')).toBeInTheDocument()
    expect(screen.getByText('ForecastTool')).toBeInTheDocument()
  })

  it('renders rows sorted by descending revenue_at_risk_000s', () => {
    const low = { ...riskFinding, application: 'ForecastTool', revenue_at_risk_000s: 500 }
    const high = { ...riskFinding, application: 'AuthService', revenue_at_risk_000s: 6400 }
    render(<SummaryReport report={{ ...baseReport, critical_risks: [low, high] }} />)
    const rows = screen.getAllByRole('row').slice(1) // skip header
    expect(rows[0]).toHaveTextContent('AuthService')
    expect(rows[1]).toHaveTextContent('ForecastTool')
  })
})

describe('SummaryReport — expandable product breakdown', () => {
  it('product breakdown is hidden before clicking the row', () => {
    const finding = {
      ...riskFinding,
      product_exposures: [
        { product: 'TechnologyAdoption', arr_000s: 3300 },
        { product: 'CorporateReporting', arr_000s: 900 },
      ],
    }
    render(<SummaryReport report={{ ...baseReport, critical_risks: [finding] }} />)
    expect(screen.queryByText('TechnologyAdoption')).not.toBeInTheDocument()
  })

  it('clicking the row reveals product breakdown in descending ARR order', async () => {
    const finding = {
      ...riskFinding,
      product_exposures: [
        { product: 'TechnologyAdoption', arr_000s: 3300 },
        { product: 'CorporateReporting', arr_000s: 900 },
      ],
    }
    const user = userEvent.setup()
    render(<SummaryReport report={{ ...baseReport, critical_risks: [finding] }} />)
    await user.click(screen.getByText('AuthService'))
    expect(screen.getByText('TechnologyAdoption')).toBeInTheDocument()
    expect(screen.getByText('CorporateReporting')).toBeInTheDocument()
    const cells = screen.getAllByText(/\$\d+k/)
    const arrValues = cells.map(c => c.textContent)
    const adoptionIdx = arrValues.indexOf('$3300k')
    const reportingIdx = arrValues.indexOf('$900k')
    expect(adoptionIdx).toBeLessThan(reportingIdx)
  })

  it('clicking the row again collapses the breakdown', async () => {
    const finding = {
      ...riskFinding,
      product_exposures: [{ product: 'TechnologyAdoption', arr_000s: 3300 }],
    }
    const user = userEvent.setup()
    render(<SummaryReport report={{ ...baseReport, critical_risks: [finding] }} />)
    await user.click(screen.getByText('AuthService'))
    expect(screen.getByText('TechnologyAdoption')).toBeInTheDocument()
    await user.click(screen.getByText('AuthService'))
    expect(screen.queryByText('TechnologyAdoption')).not.toBeInTheDocument()
  })
})

describe('SummaryReport — governance gaps', () => {
  it('renders an entry for each governance gap', () => {
    const second = { ...governanceGap, application: 'ForecastTool' }
    render(<SummaryReport report={{ ...baseReport, governance_gaps: [governanceGap, second] }} />)

    expect(screen.getByText('ContractVault')).toBeInTheDocument()
    expect(screen.getByText('ForecastTool')).toBeInTheDocument()
  })
})
