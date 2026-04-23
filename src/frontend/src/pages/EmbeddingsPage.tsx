import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Line } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import {
  divisionToColor, docTypeToShape, pointToSize,
  mergeTopKIntoPoints,
} from './EmbeddingsPage.utils'
import type { EmbeddingPoint, EmbeddingPointWithTopK } from './EmbeddingsPage.utils'
import { GROUPS } from '../components/QueryChips'

const QUERY_COLOR = '#e879f9'

function GradientBackground() {
  const { scene } = useThree()
  useEffect(() => {
    scene.background = new THREE.Color('#0f172a')
  }, [scene])
  return null
}

function CameraFit({ points, orbitRef }: {
  points: EmbeddingPoint[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orbitRef: React.RefObject<any>
}) {
  const { camera } = useThree()
  useEffect(() => {
    if (points.length === 0) return
    const radius = Math.max(...points.map(({ projected_xyz: [x, y, z] }) =>
      Math.sqrt(x * x + y * y + z * z)
    ))
    const fovRad = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
    const dist = (radius / Math.tan(fovRad / 2)) * 1.4
    camera.position.set(0, 0, dist)
    camera.lookAt(0, 0, 0)
    if (orbitRef.current) {
      orbitRef.current.target.set(0, 0, 0)
      orbitRef.current.update()
    }
  }, [points, camera, orbitRef])
  return null
}

function AutoRotate({ orbitRef }: { orbitRef: React.RefObject<{ autoRotate: boolean } | null> }) {
  const interacted = useRef(false)
  useEffect(() => {
    const stop = () => {
      interacted.current = true
      if (orbitRef.current) orbitRef.current.autoRotate = false
    }
    window.addEventListener('pointerdown', stop, { once: true })
    return () => window.removeEventListener('pointerdown', stop)
  }, [orbitRef])
  return null
}

function Point({
  data,
  onHover,
  onUnhover,
  onClick,
}: {
  data: EmbeddingPointWithTopK
  onHover: (p: EmbeddingPoint) => void
  onUnhover: () => void
  onClick: (p: EmbeddingPoint) => void
}) {
  const color = divisionToColor(data.division)
  const shape = docTypeToShape(data.doc_type)
  const sizeValue = data.doc_type === 'product' ? data.arr_000s : data.cost_000s
  const size = pointToSize(data.doc_type, sizeValue)
  const [x, y, z] = data.projected_xyz

  return (
    <group position={[x, y, z]}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); onHover(data) }}
        onPointerOut={() => onUnhover()}
        onClick={(e) => { e.stopPropagation(); onClick(data) }}
      >
        {shape === 'sphere' ? (
          <sphereGeometry args={[size, 16, 16]} />
        ) : (
          <boxGeometry args={[size * 1.6, size * 1.6, size * 1.6]} />
        )}
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {data.cited && (
        <mesh>
          {shape === 'sphere' ? (
            <sphereGeometry args={[size * 3.5, 16, 16]} />
          ) : (
            <boxGeometry args={[size * 1.6 * 3.5, size * 1.6 * 3.5, size * 1.6 * 3.5]} />
          )}
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.0} transparent opacity={0.28} side={THREE.BackSide} />
        </mesh>
      )}
    </group>
  )
}

function QueryPoint({ xyz }: { xyz: [number, number, number] }) {
  const size = 0.025
  return (
    <group position={xyz}>
      <mesh>
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial color={QUERY_COLOR} emissive={QUERY_COLOR} emissiveIntensity={2.0} />
      </mesh>
      <mesh>
        <sphereGeometry args={[size * 3.5, 16, 16]} />
        <meshStandardMaterial color={QUERY_COLOR} transparent opacity={0.28} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

function Scene({ points, queryXyz, linesVisible, pinned, onPin }: {
  points: EmbeddingPointWithTopK[]
  queryXyz: [number, number, number] | null
  linesVisible: boolean
  pinned: EmbeddingPoint | null
  onPin: React.Dispatch<React.SetStateAction<EmbeddingPoint | null>>
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orbitRef = useRef<any>(null)
  const [hovered, setHovered] = useState<EmbeddingPoint | null>(null)

  const tooltip = pinned ?? hovered

  return (
    <>
      <GradientBackground />
      <CameraFit points={points} orbitRef={orbitRef} />
      <AutoRotate orbitRef={orbitRef} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />

      {points.map((p) => (
        <Point
          key={p.id}
          data={p}
          onHover={setHovered}
          onUnhover={() => setHovered(null)}
          onClick={(pt) => onPin(prev => prev?.id === pt.id ? null : pt)}
        />
      ))}

      {queryXyz && <QueryPoint xyz={queryXyz} />}

      {linesVisible && queryXyz && points
        .filter(p => p.cited)
        .map(p => (
          <Line
            key={p.id}
            points={[queryXyz, p.projected_xyz]}
            color="#e879f9"
            lineWidth={1}
            transparent
            opacity={0.45}
          />
        ))
      }

      {linesVisible && queryXyz && points
        .filter(p => p.retrieved && !p.cited)
        .map(p => (
          <Line
            key={`retrieved-${p.id}`}
            points={[queryXyz, p.projected_xyz]}
            color="#94a3b8"
            lineWidth={1}
            transparent
            opacity={0.25}
          />
        ))
      }

      {tooltip && (
        <Html
          position={tooltip.projected_xyz}
          style={{ pointerEvents: 'none' }}
          zIndexRange={[100, 0]}
        >
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm w-56 shadow-xl">
            <p className="font-semibold text-white truncate">{tooltip.name}</p>
            <p className="text-slate-400 mt-0.5 text-xs">{tooltip.division}</p>
            <p className="mt-1">
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                tooltip.risk_rating === 'Critical' ? 'bg-red-900 text-red-300' :
                tooltip.risk_rating === 'High'     ? 'bg-orange-900 text-orange-300' :
                tooltip.risk_rating === 'Medium'   ? 'bg-yellow-900 text-yellow-300' :
                                                     'bg-green-900 text-green-300'
              }`}>{tooltip.risk_rating}</span>
            </p>
            <p className="text-slate-400 mt-1 text-xs">
              {tooltip.doc_type === 'product'
                ? `ARR $${Math.round(tooltip.arr_000s / 1000).toLocaleString()}k`
                : `Cost $${Math.round(tooltip.cost_000s / 1000).toLocaleString()}k`}
            </p>
            <p className="text-slate-300 mt-1.5 leading-snug">{tooltip.summary}</p>
          </div>
        </Html>
      )}

      <OrbitControls
        ref={orbitRef}
        autoRotate
        autoRotateSpeed={0.5}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.9}
        enableDamping
      />

      <primitive object={new THREE.AxesHelper(0.4)} />

      <EffectComposer>
        <Bloom intensity={0.3} luminanceThreshold={0.6} luminanceSmoothing={0.9} />
      </EffectComposer>
    </>
  )
}

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

interface QueryBarProps {
  onAsk?: (query: string) => void
  answer?: string
  isStreaming?: boolean
}

export function EmbeddingsQueryBar({ onAsk, answer, isStreaming }: QueryBarProps) {
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
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchParams(val ? { q: val } : {}, { replace: true })
    }, 300)
  }

  const handleChipSelect = (q: string) => {
    clearTimeout(debounceRef.current)
    setInputValue(q)
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

export default function EmbeddingsPage() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''

  const [rawPoints, setRawPoints] = useState<EmbeddingPoint[]>([])
  const [points, setPoints] = useState<EmbeddingPointWithTopK[]>([])
  const [queryXyz, setQueryXyz] = useState<[number, number, number] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [citedIds, setCitedIds] = useState<string[]>([])
  const [retrievedIds, setRetrievedIds] = useState<string[]>([])
  const [answered, setAnswered] = useState(false)
  const [pinned, setPinned] = useState<EmbeddingPoint | null>(null)
  const esRef = useRef<EventSource | null>(null)

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
      setAnswer('')
      setCitedIds([])
      setRetrievedIds([])
      setAnswered(false)
      esRef.current?.close()
      return
    }
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
  }, [q, rawPoints])

  useEffect(() => {
    setPoints(mergeTopKIntoPoints(rawPoints, citedIds, retrievedIds))
  }, [rawPoints, citedIds, retrievedIds])

  function handleAsk(query: string) {
    if (!query.trim() || isStreaming) return
    esRef.current?.close()
    setAnswer('')
    setCitedIds([])
    setAnswered(false)
    setIsStreaming(true)

    let accum = ''
    const es = new EventSource(`/query/stream?query=${encodeURIComponent(query)}`)
    esRef.current = es

    es.onmessage = (e) => {
      const data: string = e.data
      if (data.startsWith('[DONE]')) {
        es.close()
        setIsStreaming(false)
        setAnswered(true)
        try {
          const payload = JSON.parse(data.slice('[DONE] '.length)) as {
            app_sources: string[]
            product_sources: string[]
          }
          const allSources = [...payload.app_sources, ...payload.product_sources]
          setCitedIds(allSources.filter(n => accum.includes(n)))
        } catch {
          // malformed payload — ignore
        }
      } else {
        const token = JSON.parse(data) as string
        accum += token
        setAnswer((prev) => prev + token)
      }
    }

    es.onerror = () => {
      es.close()
      setIsStreaming(false)
    }
  }

  const divisions = [...new Set(rawPoints.map((p) => p.division))].sort()

  return (
    <div className="flex flex-col lg:h-full lg:overflow-hidden">
      {/* Query bar */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <EmbeddingsQueryBar onAsk={handleAsk} answer={answer} isStreaming={isStreaming} />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 px-4 pb-4 lg:flex-1 lg:overflow-hidden lg:min-h-0">
        {/* 3D canvas */}
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
                <Scene points={points} queryXyz={queryXyz} linesVisible={answered} pinned={pinned} onPin={setPinned} />
              </Suspense>
            </Canvas>
          )}

        </div>

        {/* Teaching panel */}
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
