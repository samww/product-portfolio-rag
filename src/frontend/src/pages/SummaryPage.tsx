import { useState } from 'react'
import { SummaryReport } from '../components/SummaryReport'
import type { SummaryReportData } from '../components/SummaryReport'

export function SummaryPage() {
  const [summary, setSummary] = useState<SummaryReportData | null>(null)
  const [isSummarising, setIsSummarising] = useState(false)

  async function handleSummarise() {
    if (isSummarising) return
    setIsSummarising(true)
    try {
      const res = await fetch('/summarise', { method: 'POST' })
      const data = await res.json() as SummaryReportData
      setSummary(data)
    } finally {
      setIsSummarising(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
          Risk Summary
        </h1>
        <p className="text-slate-400 text-sm">
          Portfolio risk report for Pragmenta Insights
        </p>
      </header>

      <main>
        <button
          onClick={handleSummarise}
          disabled={isSummarising}
          className="mb-8 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors cursor-pointer shadow-md shadow-violet-900/50"
        >
          {isSummarising ? 'Generating…' : 'Generate Risk Summary'}
        </button>

        {summary && <SummaryReport report={summary} />}
      </main>
    </div>
  )
}
