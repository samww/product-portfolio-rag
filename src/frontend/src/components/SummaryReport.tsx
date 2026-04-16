export interface ProductExposure {
  product: string
  arr_000s: number
}

export interface RiskFinding {
  application: string
  risk_rating: string
  issue: string
  revenue_at_risk_000s: number
  recommended_action: string
  priority: string
  product_exposures: ProductExposure[]
}

export interface GovernanceGap {
  application: string
  issue: string
  recommended_action: string
}

export interface SummaryReportData {
  overall_health: string
  executive_summary: string
  critical_risks: RiskFinding[]
  governance_gaps: GovernanceGap[]
  total_apps_reviewed: number
  total_arr_at_risk_000s: number
}

const HEALTH_BADGE: Record<string, string> = {
  Healthy: 'bg-green-500/20 text-green-300 border-green-500',
  'At Risk': 'bg-amber-500/20 text-amber-300 border-amber-500',
  Critical: 'bg-red-500/20 text-red-300 border-red-500',
}

import { useState } from 'react'

export function SummaryReport({ report }: { report: SummaryReportData }) {
  const badgeClass = HEALTH_BADGE[report.overall_health] ?? 'bg-slate-700 text-slate-300 border-slate-500'

  return (
    <div className="mt-6 bg-slate-900 border border-slate-700 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-white">Product Portfolio Risk Summary</h2>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badgeClass}`}>
          {report.overall_health}
        </span>
      </div>

      <p className="text-slate-300 text-sm leading-relaxed mb-6">{report.executive_summary}</p>

      {report.critical_risks.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
            High / Critical Risk Applications
          </h3>
          <p className="text-xs text-slate-500 mb-3">Product ARR at risk reflects the annual revenue of products whose delivery depends on each application.</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 text-xs border-b border-slate-700">
                <th className="pb-2 pr-4">Application</th>
                <th className="pb-2 pr-4">Risk</th>
                <th className="pb-2 pr-4">Issue</th>
                <th className="pb-2 pr-4">Product ARR at Risk</th>
                <th className="pb-2">Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {[...report.critical_risks]
                .sort((a, b) => b.revenue_at_risk_000s - a.revenue_at_risk_000s)
                .map((r, i) => (
                  <RiskRow key={i} risk={r} />
                ))}
            </tbody>
          </table>
        </section>
      )}

      {report.governance_gaps.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Governance Gaps
          </h3>
          <ul className="space-y-2">
            {report.governance_gaps.map((g, i) => (
              <li key={i} className="text-sm text-slate-300">
                <span className="font-medium text-slate-100">{g.application}</span>
                {' — '}
                {g.issue}
                {'. '}
                <span className="text-slate-400">{g.recommended_action}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function RiskRow({ risk }: { risk: RiskFinding }) {
  const [expanded, setExpanded] = useState(false)
  const hasBreakdown = risk.product_exposures.length > 0

  return (
    <>
      <tr
        className={`border-b border-slate-800 text-slate-300 ${hasBreakdown ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}
        onClick={() => hasBreakdown && setExpanded(e => !e)}
      >
        <td className="py-2 pr-4 font-medium text-slate-100">{risk.application}</td>
        <td className="py-2 pr-4">{risk.risk_rating}</td>
        <td className="py-2 pr-4">{risk.issue}</td>
        <td className="py-2 pr-4">
          <span className="flex items-center gap-1">
            ${risk.revenue_at_risk_000s.toLocaleString()}k
            {hasBreakdown && (
              <span className="text-slate-500 text-xs">{expanded ? '▲' : '▼'}</span>
            )}
          </span>
        </td>
        <td className="py-2">{risk.recommended_action}</td>
      </tr>
      {expanded && (
        <tr className="bg-slate-800/40">
          <td colSpan={5} className="px-4 py-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-700">
                  <th className="pb-1 pr-4">Product</th>
                  <th className="pb-1">ARR at Risk</th>
                </tr>
              </thead>
              <tbody>
                {risk.product_exposures.map((e, i) => (
                  <tr key={i} className="text-slate-400">
                    <td className="py-1 pr-4">{e.product}</td>
                    <td className="py-1">${e.arr_000s.toLocaleString()}k</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}
