import Markdown from 'react-markdown'
import { RetrievedContext } from './RetrievedContext'

interface Props {
  answer: string
  appSources: string[]
  productSources: string[]
  context: string[]
  isStreaming: boolean
}

function SourceSection({ label, sources, answer, citedClass, uncitedClass }: {
  label: string
  sources: string[]
  answer: string
  citedClass: string
  uncitedClass: string
}) {
  if (sources.length === 0) return null
  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5 block">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => {
          const cited = answer.includes(source)
          return (
            <span
              key={source}
              title={cited ? 'Cited in answer' : 'Retrieved but not directly cited'}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${cited ? citedClass : uncitedClass}`}
            >
              {source}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function ResponseDisplay({ answer, appSources, productSources, context, isStreaming }: Props) {
  if (!answer && !isStreaming) return null

  const hasSources = appSources.length > 0 || productSources.length > 0

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

        {hasSources && (
          <div className="mt-4 flex flex-col gap-3">
            <SourceSection
              label="Products"
              sources={productSources}
              answer={answer}
              citedClass="bg-yellow-400/20 text-yellow-300 border-yellow-500"
              uncitedClass="bg-blue-900/30 text-blue-400 border-blue-800 opacity-50"
            />
            <SourceSection
              label="Applications"
              sources={appSources}
              answer={answer}
              citedClass="bg-yellow-400/20 text-yellow-300 border-yellow-500"
              uncitedClass="bg-violet-900/30 text-violet-400 border-violet-800 opacity-50"
            />
          </div>
        )}

        <RetrievedContext context={context} />
      </div>
    </div>
  )
}
