import { useNavigate } from 'react-router-dom'
import SettingsHeader from '../../components/settings/SettingsHeader'

/** Frame shared by every settings page: header with a back arrow, a status line, and the content. */
export default function SettingsPage({ title, intro, error, saved, children }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen">
      <SettingsHeader title={title} onBack={() => navigate('/settings')} />
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-24 flex flex-col gap-5">
        {intro && <p className="text-sm text-on-surface-muted px-1">{intro}</p>}
        <div aria-live="polite" className="min-h-[1.25rem]">
          {error && <p role="alert" className="text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>}
          {!error && saved && <p className="text-xs text-bullish px-1">Saved</p>}
        </div>
        {children}
      </div>
    </div>
  )
}

export function Group({ title, children }) {
  return (
    <section>
      {title && <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-muted px-1 mb-2">{title}</h2>}
      <div className="bg-surface-card rounded-2xl border border-white/[0.06] divide-y divide-white/[0.06] overflow-hidden">{children}</div>
    </section>
  )
}

/** One option of a "choose one" setting. */
export function Choice({ label, description, selected, onSelect, disabled }) {
  return (
    <button
      type="button" role="radio" aria-checked={selected} disabled={disabled} onClick={onSelect}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-white/[0.03] disabled:opacity-50"
    >
      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-primary' : 'border-white/30'}`}>
        {selected && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-on-surface">{label}</span>
        {description && <span className="block text-xs text-on-surface-muted mt-0.5">{description}</span>}
      </span>
    </button>
  )
}
