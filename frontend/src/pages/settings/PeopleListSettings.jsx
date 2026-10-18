import { useCallback, useEffect, useState } from 'react'
import { postService } from '../../services/postService'
import { storyService } from '../../services/storyService'
import { useAuth } from '../../context/AuthContext'
import SettingsPage, { Group } from './SettingsPage'

const COPY = {
  'close-friends': {
    title: 'Close Friends',
    intro: 'Stories you share with Close Friends are visible only to the people on this list. They see a green ring and a Close Friends badge.',
    empty: 'Nobody yet. Search for someone to add.',
  },
  'story-hidden': {
    title: 'Hide story from',
    intro: 'These people cannot see your stories, even if they follow you. They are not told.',
    empty: 'You are not hiding your stories from anyone.',
  },
  'story-mutes': {
    title: 'Muted stories',
    intro: 'Stories from these people move to the end of your story tray. You still follow them.',
    empty: 'You have not muted anyone.',
  },
}

/** Manage one of the account lists kept by the Story Service: add people by searching, remove them with one tap. */
export default function PeopleListSettings({ kind }) {
  const { user: me } = useAuth()
  const copy = COPY[kind]
  const [members, setMembers] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(() => new Set())
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    storyService.listPeople(kind).then(setMembers).catch(err => { setError(err.message); setMembers([]) })
  }, [kind])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const term = query.trim()
    if (!term) { setResults([]); return undefined }
    setSearching(true)
    const handle = setTimeout(() => {
      postService.searchUsers(term).then(found => setResults(found.filter(u => u.uuid !== me?.id))).catch(() => setResults([])).finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [query, me?.id])

  const run = async (userId, work, after) => {
    setBusy(prev => new Set(prev).add(userId))
    setError('')
    try { await work(); after() } catch (err) { setError(err.message) } finally {
      setBusy(prev => { const s = new Set(prev); s.delete(userId); return s })
    }
  }

  const add = person => run(person.uuid, () => storyService.addPerson(kind, person.uuid), () => {
    setMembers(prev => [{ user: { user_id: person.uuid, username: person.username, display_name: person.display_name, avatar_url: person.avatar_url } }, ...(prev || [])])
    setQuery('')
  })
  const remove = member => run(member.user.user_id, () => storyService.removePerson(kind, member.user.user_id),
    () => setMembers(prev => prev.filter(m => m.user.user_id !== member.user.user_id)))

  const isMember = id => (members || []).some(m => m.user.user_id === id)
  const person = 'flex items-center gap-3 px-4 py-3'

  return (
    <SettingsPage title={copy.title} intro={copy.intro} error={error}>
      <div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people by username" aria-label="Search people to add"
          className="w-full bg-surface-card border border-white/10 rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary/50" />
        {query.trim() && (
          <div className="mt-2 bg-surface-card rounded-xl border border-white/[0.06] divide-y divide-white/[0.06] overflow-hidden">
            {searching && <p className="px-4 py-3 text-xs text-on-surface-muted">Searching…</p>}
            {!searching && results.length === 0 && <p className="px-4 py-3 text-xs text-on-surface-muted">No one found.</p>}
            {results.map(p => (
              <div key={p.uuid} className={person}>
                <img src={postService.avatarFor(p)} alt="" className="w-9 h-9 rounded-full object-cover" />
                <span className="flex-1 text-sm font-semibold text-on-surface truncate">{p.username}</span>
                <button disabled={isMember(p.uuid) || busy.has(p.uuid)} onClick={() => add(p)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold disabled:opacity-40">{isMember(p.uuid) ? 'Added' : 'Add'}</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Group title={members ? `${members.length} ${members.length === 1 ? 'person' : 'people'}` : 'Loading…'}>
        {members && members.length === 0 && <p className="px-4 py-6 text-sm text-on-surface-muted text-center">{copy.empty}</p>}
        {(members || []).map(m => (
          <div key={m.user.user_id} className={person}>
            <img src={postService.avatarFor(m.user)} alt="" className="w-10 h-10 rounded-full object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">{m.user.username || 'Unknown user'}</p>
              {m.user.display_name && <p className="text-xs text-on-surface-muted truncate">{m.user.display_name}</p>}
            </div>
            <button disabled={busy.has(m.user.user_id)} onClick={() => remove(m)} className="px-3 py-1.5 rounded-lg border border-white/15 text-xs font-semibold text-on-surface hover:bg-white/5 disabled:opacity-40">Remove</button>
          </div>
        ))}
      </Group>
    </SettingsPage>
  )
}
