import { useState } from 'react'
import { NavLink } from 'react-router-dom'

const navLinks = [
  { to: '/', label: 'Query' },
  { to: '/summary', label: 'Risk Summary' },
  { to: '/embeddings', label: 'Embeddings' },
]

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="bg-slate-900 border-b border-slate-800">
      <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
        <span className="text-white font-semibold tracking-tight">Portfolio Intelligence</span>

        {/* Desktop links */}
        <ul className="hidden sm:flex items-center gap-1" role="list">
          {navLinks.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                aria-current={undefined}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`
                }
                {...({ 'aria-current': undefined } as object)}
              >
                {({ isActive }) => {
                  return (
                    <span aria-current={isActive ? 'page' : undefined}>{label}</span>
                  )
                }}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Hamburger */}
        <button
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((o) => !o)}
          className="sm:hidden p-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div id="mobile-menu" className="sm:hidden border-t border-slate-800">
          <ul className="px-4 py-2 flex flex-col gap-1" role="list">
            {navLinks.map(({ to, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <span aria-current={isActive ? 'page' : undefined}>{label}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  )
}
