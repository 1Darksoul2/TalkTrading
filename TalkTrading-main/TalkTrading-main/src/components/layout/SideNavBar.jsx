import { Link, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/reels', icon: 'smart_display', label: 'Reels' },
  { path: '/market', icon: 'show_chart', label: 'Market' },
  { path: '/create', icon: 'add', label: 'Create' },
]

export default function SideNavBar() {
  const location = useLocation()

  return (
    <nav className="hidden md:flex fixed top-16 bottom-0 left-0 w-14 z-40 flex-col items-center gap-2 pt-[22vh] bg-surface-card/90 backdrop-blur-md border-r border-white/[0.06]">
      {navItems.map(item => {
        const isActive = location.pathname.startsWith(item.path)
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-label={item.label}
            className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
              isActive
                ? 'text-primary bg-primary/10'
                : 'text-on-surface-muted hover:text-on-surface hover:bg-white/5'
            }`}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {item.icon}
            </span>
            {/* Name appears on hover */}
            <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1 rounded-md bg-surface-container-highest text-on-surface text-xs font-semibold whitespace-nowrap shadow-lg opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0">
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
