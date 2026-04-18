import { render, screen, within } from '@testing-library/react'
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

describe('SummaryReport — risk rating pills', () => {
  it('Critical risk rating renders with a red pill', () => {
    const finding = { ...riskFinding, risk_rating: 'Critical' }
    render(<SummaryReport report={{ ...baseReport, critical_risks: [finding] }} />)
    const table = screen.getByRole('table')
    const pill = within(table).getByText('Critical')
    expect(pill.className).toMatch(/red/)
  })

  it('High risk rating renders with an orange pill', () => {
    const finding = { ...riskFinding, risk_rating: 'High' }
    render(<SummaryReport report={{ ...baseReport, critical_risks: [finding] }} />)
    const table = screen.getByRole('table')
    const pill = within(table).getByText('High')
    expect(pill.className).toMatch(/orange/)
  })

  it('Medium risk rating renders with a yellow pill', () => {
    const finding = { ...riskFinding, risk_rating: 'Medium' }
    render(<SummaryReport report={{ ...baseReport, critical_risks: [finding] }} />)
    const table = screen.getByRole('table')
    const pill = within(table).getByText('Medium')
    expect(pill.className).toMatch(/yellow/)
  })
})

describe('SummaryReport — critical risks table', () => {
  it('renders a row for each risk finding', () => {
    const second = { ...riskFinding, application: 'ForecastTool', priority: 'High' }
    render(<SummaryReport report={{ ...baseReport, critical_risks: [riskFinding, second] }} />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('AuthService')).toBeInTheDocument()
    expect(within(table).getByText('ForecastTool')).toBeInTheDocument()
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
    await user.click(within(screen.getByRole('table')).getByText('AuthService'))
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
    const table = screen.getByRole('table')
    await user.click(within(table).getByText('AuthService'))
    expect(screen.getByText('TechnologyAdoption')).toBeInTheDocument()
    await user.click(within(table).getByText('AuthService'))
    expect(screen.queryByText('TechnologyAdoption')).not.toBeInTheDocument()
  })
})

describe('SummaryReport — mobile card layout', () => {
  it('renders one card per risk finding in the mobile card list', () => {
    const second = { ...riskFinding, application: 'ForecastTool', priority: 'High' }
    render(<SummaryReport report={{ ...baseReport, critical_risks: [riskFinding, second] }} />)
    const cards = screen.getByTestId('risk-cards')
    expect(cards.querySelectorAll('[data-testid="risk-card"]')).toHaveLength(2)
  })

  it('each card shows application, risk rating, issue, ARR at risk, and recommended action', () => {
    render(<SummaryReport report={{ ...baseReport, critical_risks: [riskFinding] }} />)
    const card = screen.getByTestId('risk-card')
    expect(within(card).getByText('AuthService')).toBeInTheDocument()
    expect(within(card).getByText('Critical')).toBeInTheDocument()
    expect(within(card).getByText('No DR plan')).toBeInTheDocument()
    expect(within(card).getByText('$1,200k')).toBeInTheDocument()
    expect(within(card).getByText('Implement DR runbook')).toBeInTheDocument()
  })

  it('tapping the ARR row on a card with exposures reveals the product breakdown', async () => {
    const finding = {
      ...riskFinding,
      product_exposures: [{ product: 'TechnologyAdoption', arr_000s: 3300 }],
    }
    const user = userEvent.setup()
    render(<SummaryReport report={{ ...baseReport, critical_risks: [finding] }} />)
    const card = screen.getByTestId('risk-card')
    expect(within(card).queryByText('TechnologyAdoption')).not.toBeInTheDocument()
    await user.click(within(card).getByText('$1,200k'))
    expect(within(card).getByText('TechnologyAdoption')).toBeInTheDocument()
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
