import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const WARN_MS = 10 * 60 * 1000

/** Shown in the last 10 minutes of a login, so nobody is signed out mid-post without warning. */
export default function SessionBanner() {
  const { expiresAt, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!expiresAt || !Number.isFinite(expiresAt)) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [expiresAt])

  if (!expiresAt || !Number.isFinite(expiresAt) || expiresAt - now > WARN_MS) return null
  const minutes = Math.max(1, Math.round((expiresAt - now) / 60000))

  const renew = () => {
    logout()
    navigate('/login', { replace: true, state: { from: location.pathname } })
  }

  return (
    <div role="status" className="max-w-6xl mx-auto mb-3 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-sm text-on-surface flex items-center justify-between gap-3">
      <span>Your login ends in about {minutes} min. Save what you're writing, then log in again to continue.</span>
      <button onClick={renew} className="shrink-0 px-3 py-1 rounded-full bg-primary text-on-primary text-xs font-bold">Log in again</button>
    </div>
  )
}
