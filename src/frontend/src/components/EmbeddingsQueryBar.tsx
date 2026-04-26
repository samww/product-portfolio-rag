import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GROUPS } from './QueryChips'

interface QueryBarProps {
  onAsk?: (query: string) => void
  onQueryChange?: () => void
  answer?: string
  isStreaming?: boolean
}

export function EmbeddingsQueryBar({ onAsk, onQueryChange, answer, isStreaming }: QueryBarProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const qParam = searchParams.get('q') ?? ''
  const [inputValue, setInputValue] = useState(qParam)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    setInputValue(qParam)
  }, [qParam])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    onQueryChange?.()
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchParams(val ? { q: val } : {}, { replace: true })
    }, 300)
  }

  const handleChipSelect = (q: string) => {
    clearTimeout(debounceRef.current)
    setInputValue(q)
    onQueryChange?.()
    setSearchParams(q ? { q } : {}, { replace: true })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Type a query to find similar records…"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={(e) => { if (e.key === 'Enter' && inputValue.trim()) onAsk?.(inputValue) }}
          className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
        />
        <button
          onClick={() => onAsk?.(inputValue)}
          disabled={isStreaming}
          className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg font-semibold text-sm transition-colors cursor-pointer shadow-md shadow-violet-900/50 whitespace-nowrap"
        >
          {isStreaming ? 'Asking…' : 'Ask'}
        </button>
      </div>
      <select
        value=""
        onChange={(e) => { if (e.target.value) handleChipSelect(e.target.value) }}
        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-slate-500 cursor-pointer"
      >
        <option value="">Suggested queries…</option>
        {GROUPS.map(({ label, chips }) => (
          <optgroup key={label} label={label}>
            {chips.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {answer && (
        <div
          data-testid="answer-box"
          className="max-h-[7.5rem] overflow-y-auto rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap"
        >
          {answer}
        </div>
      )}
    </div>
  )
}
