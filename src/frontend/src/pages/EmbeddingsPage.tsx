import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { mergeTopKIntoPoints } from './EmbeddingsPage.utils'
import type { EmbeddingPoint, EmbeddingPointWithTopK } from './EmbeddingsPage.utils'
import { Scene, QUERY_COLOR } from './EmbeddingsScene'
import { EmbeddingsQueryBar } from '../components/EmbeddingsQueryBar'
import { divisionToColor } from './EmbeddingsPage.utils'
import { useQuerySession } from '../lib/querySession'
import type { SseTransport } from '../lib/querySession'

function DivisionLegend({ divisions }: { divisions: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {divisions.map((div) => (
        <span key={div} className="flex items-center gap-1.5 text-xs text-slate-300">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: divisionToColor(div) }}
          />
          {div}
        </span>
      ))}
    </div>
  )
}

export default function EmbeddingsPage({ transport }: { transport?: SseTransport } = {}) {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''

  const { answer, cited, isStreaming, ask, reset, rawPayload } = useQuerySession(transport)

  const [rawPoints, setRawPoints] = useState<EmbeddingPoint[]>([])
  const [points, setPoints] = useState<EmbeddingPointWithTopK[]>([])
  const [queryXyz, setQueryXyz] = useState<[number, number, number] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retrievedIds, setRetrievedIds] = useState<string[]>([])
  const [pinned, setPinned] = useState<EmbeddingPoint | null>(null)

  useEffect(() => {
    fetch('/points.json')
      .then((r) => r.json())
      .then((data: EmbeddingPoint[]) => { setRawPoints(data); setLoading(false) })
      .catch(() => { setError('Failed to load embedding data.'); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!q) {
      setPoints(mergeTopKIntoPoints(rawPoints, []))
      setQueryXyz(null)
      setRetrievedIds([])
      reset()
      return
    }
    reset()
    setRetrievedIds([])

    if (rawPoints.length === 0) return

    fetch('/embeddings/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, top_k: 8 }),
    })
      .then((r) => r.json())
      .then(({ projected_xyz, top_k_ids }: { projected_xyz: [number, number, number]; top_k_ids: string[] }) => {
        setQueryXyz(projected_xyz)
        setRetrievedIds(top_k_ids ?? [])
      })
      .catch(() => {})
  }, [q, rawPoints]) // eslint-disable-line react-hooks/exhaustive-deps

  const citedIds = cited.map((c) => c.name)

  useEffect(() => {
    setPoints(mergeTopKIntoPoints(rawPoints, citedIds, retrievedIds))
  }, [rawPoints, citedIds.join(','), retrievedIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const divisions = [...new Set(rawPoints.map((p) => p.division))].sort()

  return (
    <div className="flex flex-col lg:h-full lg:overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <EmbeddingsQueryBar
          onAsk={(query) => { if (query.trim() && !isStreaming) ask(query) }}
          onQueryChange={reset}
          answer={answer}
          isStreaming={isStreaming}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 px-4 pb-4 lg:flex-1 lg:overflow-hidden lg:min-h-0">
        <div className="h-[60vh] lg:h-auto lg:flex-1 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
              Loading embeddings…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm px-8 text-center">
              {error}
            </div>
          )}
          {!loading && !error && (
            <Canvas camera={{ position: [0, 0, 3], fov: 60 }} onPointerMissed={() => setPinned(null)}>
              <Suspense fallback={null}>
                <Scene points={points} queryXyz={queryXyz} linesVisible={rawPayload !== null} pinned={pinned} onPin={setPinned} />
              </Suspense>
            </Canvas>
          )}
        </div>

        <aside className="lg:w-72 flex-shrink-0 flex flex-col gap-4 text-sm text-slate-300 overflow-y-auto">
          <div>
            <h2 className="text-white font-semibold text-base mb-2">Embedding space</h2>
            <p className="leading-relaxed text-slate-400">
              Each point is an application or product. Its position comes from compressing a
              1 536-dimensional OpenAI embedding down to three dimensions using PCA — a linear
              transform fitted once at ingest time. Points that are close together have similar
              semantic content; distance in this chart reflects semantic distance in the original
              embedding space.
            </p>
            <p className="leading-relaxed text-slate-500 text-xs mt-2">
              Visual proximity is approximate. Top-k retrieval uses full 1 536-dim cosine similarity,
              so a point that looks close in 3D may not be retrieved — and vice versa.
            </p>
          </div>

          <div>
            <h3 className="text-slate-200 font-medium mb-1.5">Shape</h3>
            <div className="flex gap-4 text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-slate-400" /> Application
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 bg-slate-400" /> Product
              </span>
            </div>
          </div>

          {divisions.length > 0 && (
            <div>
              <h3 className="text-slate-200 font-medium mb-1.5">Division (colour)</h3>
              <DivisionLegend divisions={divisions} />
            </div>
          )}

          <div>
            <h3 className="text-slate-200 font-medium mb-1.5">Size</h3>
            <p className="text-slate-400">Sphere size = annual operating cost (applications). Cube size = ARR (products). Larger = more financially significant.</p>
          </div>

          {queryXyz && (
            <div>
              <h3 className="text-slate-200 font-medium mb-1.5">Query</h3>
              <div className="flex flex-col gap-1.5 text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: QUERY_COLOR }} />
                  Query point
                </span>
                <span className="flex items-center gap-2">
                  <span className="inline-block w-6 h-px" style={{ backgroundColor: QUERY_COLOR, opacity: 0.8 }} />
                  Cited in answer
                </span>
                <span className="flex items-center gap-2">
                  <span className="inline-block w-6 h-px bg-slate-400 opacity-50" />
                  Retrieved, not cited
                </span>
              </div>
            </div>
          )}

          <div className="mt-auto text-slate-500 text-xs">
            {rawPoints.length > 0 && `${rawPoints.length} records • hover or tap to inspect`}
          </div>
        </aside>
      </div>
    </div>
  )
}
