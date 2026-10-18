import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'
import { useAuth } from '../../context/AuthContext'
import { postService } from '../../services/postService'
import { DEFAULT_AVATAR } from '../../utils/defaultAvatar'

export default function TopAppBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR)

  // Your real profile picture; refreshed when you change it.
  useEffect(() => {
    if (!user) return
    const load = () => postService.getMyProfile().then(p => setAvatar(postService.avatarFor(p))).catch(() => {})
    load()
    window.addEventListener('tt:profile-changed', load)
    return () => window.removeEventListener('tt:profile-changed', load)
  }, [user])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const navLinks = [
    { path: '/', label: 'Home', icon: 'home' },
    { path: '/communities', label: 'Communities', icon: 'groups' },
    { path: '/explore', label: 'Explore', icon: 'search' },
    { path: '/chats', label: 'Chats', icon: 'chat' },
    { path: '/news', label: 'News', icon: 'newspaper' },
    { path: '/market', label: 'Market', icon: 'show_chart' },
  ]

  return (
    <header className="fixed top-0 w-full z-50 h-16 bg-surface-card/90 backdrop-blur-md border-b border-white/[0.06]">
      <div className="flex justify-between items-center h-full px-4 md:px-8 max-w-[1920px] mx-auto">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-container bg-clip-text text-transparent">
            TalkTrading
          </h1>
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
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NotificationBell />
          <Link
            to="/settings"
            className={`p-2 rounded-full transition-all ${
              location.pathname.startsWith('/settings')
                ? 'text-primary bg-primary/10'
                : 'text-on-surface-muted hover:text-on-surface hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </Link>
          <Link to="/profile" className="ml-1 w-8 h-8 rounded-full overflow-hidden bg-surface-container-high" title={user?.username}>
            <img
              src={avatar}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 rounded-full text-on-surface-muted hover:text-error hover:bg-error/10 transition-all"
            title="Log out"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}
