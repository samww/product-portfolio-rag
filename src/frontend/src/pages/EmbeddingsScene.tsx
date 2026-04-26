import { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls, Html, Line } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { divisionToColor, docTypeToShape, pointToSize } from './EmbeddingsPage.utils'
import type { EmbeddingPoint, EmbeddingPointWithTopK } from './EmbeddingsPage.utils'

export const QUERY_COLOR = '#e879f9'

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

export function Scene({ points, queryXyz, linesVisible, pinned, onPin }: {
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
