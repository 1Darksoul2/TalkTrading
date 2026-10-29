import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LEGAL_UPDATED } from '../../config'

const PAGES = [
  { to: '/terms', label: 'Terms of Use' },
  { to: '/privacy', label: 'Privacy Notice' },
  { to: '/guidelines', label: 'Community Guidelines' },
]

/** Shell for the public legal pages: readable whether or not you are signed in. */
export default function LegalLayout({ title, children }) {
  const { isAuthenticated } = useAuth()
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="border-b border-white/[0.06] bg-surface-card/90">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to={isAuthenticated ? '/' : '/login'} className="font-bold text-primary">Talk Trading</Link>
          <Link to={isAuthenticated ? '/' : '/login'} className="text-sm text-on-surface-muted hover:text-on-surface">
            {isAuthenticated ? 'Back to the app' : 'Sign in'}
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <nav className="flex flex-wrap gap-2 mb-6" aria-label="Legal pages">
          {PAGES.map(p => (
            <Link key={p.to} to={p.to} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/[0.08] text-on-surface-muted hover:text-on-surface">
              {p.label}
            </Link>
          ))}
        </nav>
        <h1 className="text-2xl font-bold mb-1">{title}</h1>
        <p className="text-xs text-on-surface-muted mb-6">Beta version · last updated {LEGAL_UPDATED}</p>
        <div className="legal-body space-y-4 text-sm leading-relaxed text-on-surface/90">{children}</div>
      </main>
    </div>
  )
}

export function H({ children }) {
  return <h2 className="text-base font-semibold text-on-surface pt-2">{children}</h2>
}

export function List({ items }) {
  return <ul className="list-disc pl-5 space-y-1.5">{items.map(i => <li key={i}>{i}</li>)}</ul>
}
