import { useState } from 'react'
import { Link } from 'react-router-dom'
import NotificationList from '../notifications/NotificationList'
import { useNotifications } from '../../hooks/useNotifications'

const PREVIEW = 15

/** The bell: unread badge, and a panel with the latest activity and a link to the full Notifications page. */
export default function NotificationBell() {
  const { unread, items, partial, load, markRead, markAll } = useNotifications()
  const [open, setOpen] = useState(false)

  const toggle = () => {
    const opening = !open
    setOpen(opening)
    if (opening) load()
  }

  return (
    <div className="relative">
      <button onClick={toggle} aria-label="Notifications" className="p-2 rounded-full text-on-surface-muted hover:text-on-surface hover:bg-white/5 transition-all relative">
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 bg-primary text-on-primary rounded-full text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto z-50 bg-surface-card border border-white/10 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-on-surface">Notifications</h3>
              {(unread > 0 || items.some(n => !n.is_read)) && <button onClick={markAll} className="text-xs font-semibold text-primary hover:underline">Mark all read</button>}
            </div>
            {partial && <p className="px-4 py-2 text-[11px] text-on-surface-muted bg-white/5">Some notifications could not be loaded right now.</p>}
            {items.length === 0
              ? <p className="text-xs text-on-surface-muted text-center py-10">Nothing yet.</p>
              : <NotificationList items={items.slice(0, PREVIEW)} markRead={markRead} onNavigate={() => setOpen(false)} />}
            <Link to="/notifications" onClick={() => setOpen(false)} className="block text-center text-xs font-semibold text-primary py-3 border-t border-white/10 hover:bg-white/5">See all activity</Link>
          </div>
        </>
      )}
    </div>
  )
}
