import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto text-center py-20 px-4 space-y-3">
      <span className="material-symbols-outlined text-5xl text-on-surface-muted">explore_off</span>
      <h1 className="text-lg font-semibold text-on-surface">This page does not exist</h1>
      <p className="text-sm text-on-surface-muted">The link may be broken, or the content was removed.</p>
      <Link to="/" className="inline-block px-5 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold">Go to the feed</Link>
    </div>
  )
}
