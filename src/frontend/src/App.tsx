import { useState, useRef } from 'react'
import { QueryChips } from './components/QueryChips'
import { ResponseDisplay } from './components/ResponseDisplay'
import { SummaryReport } from './components/SummaryReport'
import type { SummaryReportData } from './components/SummaryReport'

function App() {
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [appSources, setAppSources] = useState<string[]>([])
  const [productSources, setProductSources] = useState<string[]>([])
  const [context, setContext] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [summary, setSummary] = useState<SummaryReportData | null>(null)
  const [isSummarising, setIsSummarising] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  function handleChipSelect(chipQuery: string) {
    setQuery(chipQuery)
    submit(chipQuery)
  }

  function submit(q: string) {
    if (!q.trim() || isStreaming) return

    esRef.current?.close()

    setAnswer('')
    setAppSources([])
    setProductSources([])
    setContext([])
    setIsStreaming(true)

    const es = new EventSource(`/query/stream?query=${encodeURIComponent(q)}`)
    esRef.current = es

    es.onmessage = (e) => {
      const data: string = e.data
      if (data.startsWith('[DONE]')) {
        es.close()
        setIsStreaming(false)
        const json = data.slice('[DONE] '.length)
        try {
          const payload = JSON.parse(json) as {
            app_sources: string[]
            product_sources: string[]
            context: string[]
            query: string
          }
          setAppSources(payload.app_sources)
          setProductSources(payload.product_sources)
          setContext(payload.context)
        } catch {
          // malformed payload — ignore
        }
      } else {
        setAnswer((prev) => prev + (JSON.parse(data) as string))
      }
    }

    es.onerror = () => {
      es.close()
      setIsStreaming(false)
    }
  }

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') submit(query)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
              Portfolio Intelligence
            </h1>
            <p className="text-slate-400 text-sm">
              Ask questions about Pragmenta Insights' application and product portfolio
            </p>
          </div>
          <button
            onClick={handleSummarise}
            disabled={isSummarising}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm font-medium text-slate-200 border border-slate-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            {isSummarising ? 'Generating…' : 'Generate Risk Summary'}
          </button>
        </header>

        <QueryChips onSelect={handleChipSelect} />

        <div className="mt-6 flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about the portfolio…"
            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
          <button
            onClick={() => submit(query)}
            disabled={isStreaming}
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg font-medium text-sm transition-colors cursor-pointer"
          >
            {isStreaming ? 'Streaming…' : 'Ask'}
          </button>
        </div>

        <ResponseDisplay
          answer={answer}
          appSources={appSources}
          productSources={productSources}
          context={context}
          isStreaming={isStreaming}
        />

        {summary && <SummaryReport report={summary} />}
      </div>
    </div>
  )
}

export default App
