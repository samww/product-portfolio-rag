import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

export function Layout() {
  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar />
      <div className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
