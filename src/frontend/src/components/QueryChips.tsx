import { useState } from 'react'

interface Props {
  onSelect: (query: string) => void
}

export const GROUPS = [
  {
    label: 'Risk',
    chips: [
      "How much revenue is at risk from the DataLicensing product's infrastructure dependencies?",
      'Which applications have a Critical or High risk rating?',
    ],
  },
  {
    label: 'ROI',
    chips: [
      'Which products have the highest ROI relative to their application costs?',
      'Are there any products where application costs exceed the revenue they support?',
    ],
  },
  {
    label: 'Governance',
    chips: [
      'Which applications have no named owner?',
      'Which applications are approaching end-of-life?',
    ],
  },
  {
    label: 'Explore',
    chips: [
      'Which applications have been recently modernised and what savings did that deliver?',
      'Are there applications with overlapping capabilities that could be consolidated?',
    ],
  },
]

export function QueryChips({ onSelect }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>{open ? 'Hide suggested queries' : 'Show suggested queries'}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-4">
          {GROUPS.map(({ label, chips }) => (
            <div key={label}>
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 block">
                {label}
              </span>
              <div className="flex flex-wrap gap-2">
                {chips.map((query) => (
                  <button
                    key={query}
                    onClick={() => { setOpen(false); onSelect(query) }}
                    className="px-3 py-1.5 rounded-full text-sm bg-green-900 text-green-100 border border-green-700 hover:bg-green-800 hover:border-green-500 transition-colors cursor-pointer"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
