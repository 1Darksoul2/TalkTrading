import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { postService } from '../../services/postService'
import { useE2E } from '../../context/E2EContext'

/**
 * Pick people and send them `message` as an end-to-end encrypted chat message (through the existing chat
 * client). Recent conversations are offered first; anyone can be found by search.
 */
export default function SendToSheet({ title = 'Send', message, onClose, onSent }) {
  const { isReady, userId, conversations, participantNames, startConversation, encryptAndSend } = useE2E()
  const [query, setQuery] = useState('')
  const [found, setFound] = useState([])
  const [selected, setSelected] = useState({})       // uuid -> username
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)         // { sent: [...], failed: [...] }

  const recent = useMemo(() => {
    const people = []
    for (const c of conversations || []) {
      const others = (c.participants || []).filter(p => p !== userId)
      if (others.length === 1 && participantNames[others[0]] && !people.some(p => p.uuid === others[0])) {
        people.push({ uuid: others[0], username: participantNames[others[0]] })
      }
    }
    return people.slice(0, 8)
  }, [conversations, participantNames, userId])

  useEffect(() => {
    const term = query.trim()
    if (!term) { setFound([]); return undefined }
    const handle = setTimeout(() => {
      postService.searchUsers(term).then(list => setFound(list.filter(u => u.uuid !== userId))).catch(() => setFound([]))
    }, 300)
    return () => clearTimeout(handle)
  }, [query, userId])

  const toggle = person => setSelected(prev => {
    const next = { ...prev }
    if (next[person.uuid]) delete next[person.uuid]; else next[person.uuid] = person.username
    return next
  })

  const send = async () => {
    setSending(true)
    const sent = []
    const failed = []
    for (const [uuid, username] of Object.entries(selected)) {
      try {
        const conversation = await startConversation([uuid])
        await encryptAndSend(conversation.conversation_id, [uuid], message)
        sent.push(username)
      } catch {
        failed.push(username)
      }
    }
    setSending(false)
    setResult({ sent, failed })
    if (sent.length && !failed.length) setTimeout(() => onSent?.(sent), 900)
  }

  const list = query.trim() ? found : recent
  const chosen = Object.keys(selected).length

  return createPortal(
    <div className="fixed inset-0 z-[95] bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full sm:max-w-md max-h-[80vh] bg-surface-card rounded-t-2xl sm:rounded-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-base font-bold text-on-surface">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 text-on-surface-muted"><span className="material-symbols-outlined">close</span></button>
        </div>
        {!isReady && <p className="px-4 pb-2 text-xs text-on-surface-muted">Setting up encrypted messaging…</p>}
        <div className="px-4 pb-2">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people" aria-label="Search people to send to"
            className="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50" />
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {!query.trim() && recent.length > 0 && <p className="px-2 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">Recent</p>}
          {list.map(p => (
            <label key={p.uuid} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer">
              <img src={postService.avatarFor(p)} alt="" className="w-10 h-10 rounded-full object-cover" />
              <span className="flex-1 text-sm font-semibold text-on-surface truncate">{p.username}</span>
              <input type="checkbox" checked={Boolean(selected[p.uuid])} onChange={() => toggle(p)} aria-label={`Send to ${p.username}`} className="w-5 h-5 accent-[var(--color-primary)]" />
            </label>
          ))}
          {query.trim() && list.length === 0 && <p className="px-2 py-6 text-center text-sm text-on-surface-muted">No one found.</p>}
          {!query.trim() && recent.length === 0 && <p className="px-2 py-6 text-center text-sm text-on-surface-muted">Search for someone to send this to.</p>}
        </div>
        {result && (
          <p role="status" className={`px-4 py-2 text-xs ${result.failed.length ? 'text-error' : 'text-bullish'}`}>
            {result.sent.length > 0 && `Sent to ${result.sent.join(', ')}. `}
            {result.failed.length > 0 && `Couldn't send to ${result.failed.join(', ')} (they may not have opened the app since messaging was enabled).`}
          </p>
        )}
        <div className="p-3 border-t border-white/10">
          <button onClick={send} disabled={!chosen || sending || !isReady} className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold disabled:opacity-40">
            {sending ? 'Sending…' : chosen > 1 ? `Send separately to ${chosen}` : 'Send'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
