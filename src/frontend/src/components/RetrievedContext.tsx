import { useState } from 'react'

interface Props {
  context: string[]
}

export function RetrievedContext({ context }: Props) {
  const [open, setOpen] = useState(false)

  if (context.length === 0) return null

  return (
    <div className="mt-4 border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2 bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition-colors cursor-pointer"
      >
        <span>{open ? 'Hide' : 'Show'} Retrieved Context</span>
        <span className="text-slate-500">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="bg-slate-900 p-4 space-y-4 max-h-96 overflow-y-auto">
          {context.map((doc, i) => (
            <pre
              key={i}
              className="text-xs text-slate-400 whitespace-pre-wrap font-mono border border-slate-700 rounded p-3"
            >
              {doc}
            </pre>
          ))}
        </div>
      )}
    </div>
  )
}
