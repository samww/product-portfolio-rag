import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { SummaryPage } from './pages/SummaryPage'

const EmbeddingsPage = lazy(() => import('./pages/EmbeddingsPage'))

export const routes = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/summary', element: <SummaryPage /> },
      {
        path: '/embeddings',
        element: (
          <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>}>
            <EmbeddingsPage />
          </Suspense>
        ),
      },
    ],
  },
]

const router = createBrowserRouter(routes)

export default function App() {
  return <RouterProvider router={router} />
}
