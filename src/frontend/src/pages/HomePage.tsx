import { useState, useRef, useEffect } from 'react'
import { QueryChips } from '../components/QueryChips'
import { ResponseDisplay } from '../components/ResponseDisplay'
import { useQuerySession } from '../lib/querySession'

export function HomePage() {
  const [query, setQuery] = useState('')
  const { answer, cited, context, isStreaming, ask, reset, rawPayload } = useQuerySession()

  const uncited = rawPayload ? [
    ...rawPayload.app_sources
      .filter((n) => !cited.some((c) => c.name === n))
      .map((n) => ({ name: n, kind: 'app' as const })),
    ...rawPayload.product_sources
      .filter((n) => !cited.some((c) => c.name === n))
      .map((n) => ({ name: n, kind: 'product' as const })),
  ] : []
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [query])

  function handleChipSelect(chipQuery: string) {
    setQuery(chipQuery)
    reset()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ask(query)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            Portfolio Intelligence
          </h1>
          <p className="text-slate-400 text-sm">
            Ask questions about Pragmenta Insights' application and product portfolio
          </p>
        </header>

        <QueryChips onSelect={handleChipSelect} />

        <div className="mt-6 rounded-xl border-2 border-violet-500/40 bg-slate-800 shadow-lg shadow-violet-950/30 focus-within:border-violet-500/80 focus-within:shadow-violet-900/40 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about the portfolio…"
            className="w-full bg-transparent px-4 pt-3.5 pb-2 text-slate-100 placeholder-slate-500 focus:outline-none resize-none overflow-hidden leading-relaxed"
          />
          <div className="flex items-center justify-between px-3 pb-3">
            <span className="text-xs text-slate-500">Enter to send · Shift+Enter for newline</span>
            <button
              onClick={() => ask(query)}
              disabled={isStreaming}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg font-semibold text-sm transition-colors cursor-pointer shadow-md shadow-violet-900/50"
            >
              {isStreaming ? 'Streaming…' : 'Ask'}
            </button>
          </div>
        </div>

        <ResponseDisplay
          answer={answer}
          cited={cited}
          uncited={uncited}
          context={context}
          isStreaming={isStreaming}
        />
    </div>
  )
}
