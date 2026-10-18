import { Link, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/communities', icon: 'groups', label: 'Communities' },
  { path: '/explore', icon: 'search', label: 'Search' },
  { path: '/reels', icon: 'smart_display', label: 'Reels' },
  { path: '/chats', icon: 'chat', label: 'Chats' },
  { path: '/news', icon: 'newspaper', label: 'News' },
]

export default function BottomNavBar() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 w-full z-50 md:hidden bg-surface-card/95 backdrop-blur-md border-t border-white/[0.06] rounded-t-2xl">
      <div className="flex justify-around items-center px-4 py-2">
        {navItems.map(item => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path))
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-2 transition-all active:scale-90 ${
                isActive ? 'text-primary' : 'text-on-surface-muted'
              }`}
            >
              <span
                className="material-symbols-outlined text-[22px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
