import { lazy, Suspense } from 'react'

const EmbeddingsPage = lazy(() => import('./EmbeddingsPage'))

export function LazyEmbeddingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>}>
      <EmbeddingsPage />
    </Suspense>
  )
}
