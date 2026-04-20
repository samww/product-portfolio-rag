import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { SummaryPage } from './pages/SummaryPage'

export const routes = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/summary', element: <SummaryPage /> },
      { path: '/embeddings', element: <div className="max-w-4xl mx-auto px-6 py-12"><p className="text-slate-400">Coming soon.</p></div> },
    ],
  },
]

const router = createBrowserRouter(routes)

export default function App() {
  return <RouterProvider router={router} />
}
