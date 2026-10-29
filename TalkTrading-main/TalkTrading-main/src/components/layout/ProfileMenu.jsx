import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { postService } from '../../services/postService'
import { DEFAULT_AVATAR } from '../../utils/defaultAvatar'

export default function ProfileMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const [profile, setProfile] = useState(null)

  // Your real name and photo; refreshed when you edit your profile.
  useEffect(() => {
    if (!user) return
    const load = () => postService.getMyProfile().then(setProfile, err => console.error('Could not load your profile:', err))
    load()
    window.addEventListener('tt:profile-changed', load)
    return () => window.removeEventListener('tt:profile-changed', load)
  }, [user])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleLogout = () => {
    setOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative ml-1" ref={menuRef}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="block w-8 h-8 rounded-full overflow-hidden bg-surface-container-high"
        aria-label="Account menu"
        aria-expanded={open}
      >
        <img src={profile ? postService.avatarFor(profile) : DEFAULT_AVATAR} alt="" className="w-full h-full object-cover" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface-card border border-outline-variant shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-outline-variant">
            <div className="text-sm font-semibold text-on-surface truncate">{profile?.display_name || user?.username}</div>
            <div className="text-xs text-on-surface-muted truncate">@{user?.username}</div>
          </div>
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-on-surface-muted hover:text-on-surface hover:bg-on-surface/5 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
            Profile
          </Link>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-on-surface-muted hover:text-on-surface hover:bg-on-surface/5 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
            Settings
          </Link>
          <Link
            to="/feedback"
            state={{ from: location.pathname }}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-on-surface-muted hover:text-on-surface hover:bg-on-surface/5 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">feedback</span>
            Send feedback
          </Link>
          <Link
            to="/status"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-on-surface-muted hover:text-on-surface hover:bg-on-surface/5 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">monitor_heart</span>
            Service status
          </Link>
          <div className="px-4 py-2 border-t border-outline-variant flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-on-surface-muted">
            <Link to="/terms" onClick={() => setOpen(false)} className="hover:text-on-surface">Terms</Link>
            <Link to="/privacy" onClick={() => setOpen(false)} className="hover:text-on-surface">Privacy</Link>
            <Link to="/guidelines" onClick={() => setOpen(false)} className="hover:text-on-surface">Guidelines</Link>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-bearish hover:bg-bearish/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
