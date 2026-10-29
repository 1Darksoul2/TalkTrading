import { useEffect, useMemo } from 'react'
import NotificationList from '../components/notifications/NotificationList'
import { useNotifications } from '../hooks/useNotifications'
import { parseServerDate } from '../utils/time'

const DAY = 86400000

function bucket(iso) {
  const age = Date.now() - parseServerDate(iso).getTime()
  if (age < DAY) return 'Today'
  if (age < 7 * DAY) return 'This week'
  if (age < 30 * DAY) return 'This month'
  return 'Earlier'
}

/** /notifications - all activity, grouped like Instagram (Today, This week, This month, Earlier). */
export default function NotificationsPage() {
  const { items, loading, partial, load, markRead, markAll } = useNotifications()
  useEffect(() => { load() }, [load])

  const groups = useMemo(() => {
    const out = {}
    for (const n of items) (out[bucket(n.created_at)] ||= []).push(n)
    return ['Today', 'This week', 'This month', 'Earlier'].filter(k => out[k]).map(k => [k, out[k]])
  }, [items])
  const unread = items.some(n => !n.is_read)

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-xl font-bold text-on-surface">Notifications</h1>
        {unread && <button onClick={markAll} className="text-sm font-semibold text-primary hover:underline">Mark all as read</button>}
      </div>
      {partial && <p className="mx-4 mb-3 text-xs text-on-surface-muted bg-white/5 rounded-lg px-3 py-2">Some notifications could not be loaded right now. <button onClick={load} className="font-semibold underline">Retry</button></p>}
      {loading && items.length === 0 && <p className="text-center text-sm text-on-surface-muted py-16" aria-busy="true">Loading…</p>}
      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-on-surface-muted">
          <span className="material-symbols-outlined text-5xl">favorite</span>
          <p className="mt-2 text-sm">When people like, comment, follow or reply to your stories, you&apos;ll see it here.</p>
        </div>
      )}
      {groups.map(([title, list]) => (
        <section key={title} aria-label={title} className="mb-2">
          <h2 className="px-4 pt-3 pb-1 text-sm font-bold text-on-surface">{title}</h2>
          <NotificationList items={list} markRead={markRead} followBack />
        </section>
      ))}
    </div>
  )
}
