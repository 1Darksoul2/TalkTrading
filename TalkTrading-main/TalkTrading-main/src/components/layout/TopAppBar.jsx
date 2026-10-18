import { Link, useLocation } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import ProfileMenu from './ProfileMenu'
import { useTheme } from '../../context/ThemeContext'
import logo from '../../assets/logo.png'
import logoLight from '../../assets/logo-light.png'

export default function TopAppBar() {
  const location = useLocation()
  const { theme } = useTheme()

  const navLinks = [
    { path: '/', label: 'Home', icon: 'home' },
    { path: '/communities', label: 'Communities', icon: 'groups' },
    { path: '/explore', label: 'Explore', icon: 'search' },
    { path: '/reels', label: 'Reels', icon: 'smart_display' },
    { path: '/chats', label: 'Chats', icon: 'chat' },
    { path: '/news', label: 'News', icon: 'newspaper' },
  ]

  return (
    <header className="fixed top-0 w-full z-50 h-16 bg-surface-card/90 backdrop-blur-md border-b border-white/[0.06]">
      <div className="flex justify-between items-center h-full px-4 md:px-8 max-w-[1920px] mx-auto">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img
            src={theme === 'light' ? logoLight : logo}
            alt="TalkTrading"
            className="w-10 h-10 object-contain rounded-lg"
          />
          <span
            className="text-lg font-bold hidden sm:inline"
            style={{ color: theme === 'light' ? '#1A1B1E' : '#D4AF37' }}
          >
            Talk Trading
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(link => {
            const isActive = location.pathname === link.path ||
              (link.path !== '/' && location.pathname.startsWith(link.path))
            return (
              <Link
                key={link.path}
                to={link.path}
                title={link.label}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-on-surface-muted hover:text-on-surface hover:bg-white/5'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {link.icon}
                </span>
                <span className="hidden lg:inline">{link.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button className="p-2 rounded-full text-on-surface-muted hover:text-on-surface hover:bg-white/5 transition-all relative">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
          </button>
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}
