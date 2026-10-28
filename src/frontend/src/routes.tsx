import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { SummaryPage } from './pages/SummaryPage'
import { LazyEmbeddingsPage } from './pages/LazyEmbeddingsPage'

export const routes = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/summary', element: <SummaryPage /> },
      { path: '/embeddings', element: <LazyEmbeddingsPage /> },
    ],
  },
]
