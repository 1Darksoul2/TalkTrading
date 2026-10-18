import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import SettingsHeader from '../components/settings/SettingsHeader'
import SettingsRow from '../components/settings/SettingsRow'
import Input from '../components/ui/Input'
import { PAGES, SECTIONS, findPage } from './settings/registry'

const chevron = <span className="material-symbols-outlined text-on-surface-muted text-[20px]">chevron_right</span>

/** /settings: the list of pages. /settings/:itemId: one page. Every page is a real, working setting. */
export default function Settings() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? PAGES.filter(p => p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) : null
  }, [query])

  if (itemId) {
    const page = findPage(itemId)
    return page ? page.element : <Navigate to="/settings" replace />
  }

  const row = page => (
    <SettingsRow key={page.id} icon={page.icon} label={page.label} description={page.description}
      onClick={() => navigate(`/settings/${page.id}`)} trailing={chevron} />
  )

  return (
    <div className="min-h-screen">
      <SettingsHeader title="Settings & Activity" onBack={() => navigate('/profile')} />
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <Input placeholder="Search settings" icon="search" value={query} onChange={e => setQuery(e.target.value)} className="mb-5" />
        {matches ? (
          <div className="bg-surface-card rounded-2xl border border-white/[0.06] divide-y divide-white/[0.06] overflow-hidden">
            {matches.length === 0
              ? <p className="px-4 py-6 text-sm text-on-surface-muted text-center">No settings found for &ldquo;{query}&rdquo;</p>
              : matches.map(row)}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {SECTIONS.map(section => (
              <section key={section.id}>
                <div className="flex items-center gap-2 px-1 mb-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">{section.icon}</span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-muted">{section.title}</h2>
                </div>
                <div className="bg-surface-card rounded-2xl border border-white/[0.06] divide-y divide-white/[0.06] overflow-hidden">
                  {PAGES.filter(p => p.section === section.id).map(row)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
