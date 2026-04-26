import Markdown from 'react-markdown'
import { RetrievedContext } from './RetrievedContext'
import type { CitedSource } from '../lib/querySession'

interface Props {
  answer: string
  cited: CitedSource[]
  uncited: CitedSource[]
  context: string[]
  isStreaming: boolean
}

const CITED_CLASS = 'bg-yellow-400/20 text-yellow-300 border-yellow-500'
const APP_UNCITED_CLASS = 'bg-violet-900/30 text-violet-400 border-violet-800 opacity-50'
const PRODUCT_UNCITED_CLASS = 'bg-blue-900/30 text-blue-400 border-blue-800 opacity-50'

function SourceChips({ sources, citedClass }: { sources: CitedSource[]; citedClass: string }) {
  return (
    <>
      {sources.map((s) => (
        <span
          key={s.name}
          title="Cited in answer"
          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${citedClass}`}
        >
          {s.name}
        </span>
      ))}
    </>
  )
}

function UncitedChips({ sources, uncitedClass }: { sources: CitedSource[]; uncitedClass: string }) {
  return (
    <>
      {sources.map((s) => (
        <span
          key={s.name}
          title="Retrieved but not directly cited"
          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${uncitedClass}`}
        >
          {s.name}
        </span>
      ))}
    </>
  )
}

export function ResponseDisplay({ answer, cited, uncited, context, isStreaming }: Props) {
  if (!answer && !isStreaming) return null

  const citedApps = cited.filter((c) => c.kind === 'app')
  const citedProducts = cited.filter((c) => c.kind === 'product')
  const uncitedApps = uncited.filter((c) => c.kind === 'app')
  const uncitedProducts = uncited.filter((c) => c.kind === 'product')

  const hasProducts = citedProducts.length > 0 || uncitedProducts.length > 0
  const hasApps = citedApps.length > 0 || uncitedApps.length > 0

  return (
    <div className="mt-6">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
        <div className="prose prose-invert prose-sm max-w-none text-slate-100
          prose-p:leading-relaxed prose-p:my-2
          prose-ol:my-2 prose-ul:my-2
          prose-li:my-0.5
          prose-strong:text-white">
          <Markdown>{answer}</Markdown>
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-violet-400 animate-pulse align-middle" />
          )}
        </div>

        {(hasProducts || hasApps) && (
          <div className="mt-4 flex flex-col gap-3">
            {hasProducts && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5 block">
                  Products
                </span>
                <div className="flex flex-wrap gap-2">
                  <SourceChips sources={citedProducts} citedClass={CITED_CLASS} />
                  <UncitedChips sources={uncitedProducts} uncitedClass={PRODUCT_UNCITED_CLASS} />
                </div>
              </div>
            )}
            {hasApps && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5 block">
                  Applications
                </span>
                <div className="flex flex-wrap gap-2">
                  <SourceChips sources={citedApps} citedClass={CITED_CLASS} />
                  <UncitedChips sources={uncitedApps} uncitedClass={APP_UNCITED_CLASS} />
                </div>
              </div>
            )}
          </div>
        )}

        <RetrievedContext context={context} />
      </div>
    </div>
  )
}
