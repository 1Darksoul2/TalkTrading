import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../ui/Card'
import { postService } from '../../services/postService'
import { useAuth } from '../../context/AuthContext'

const DISMISSED_KEY = 'tt-dismissed-suggestions'
const SAMPLE = 15     // how many of the accounts you follow are looked at for friends-of-friends
const SHOW = 5

function dismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')) } catch { return new Set() }
}

/**
 * "Suggested for you", built from the real follow graph: people who follow you that you don't follow back,
 * then people followed by several accounts you follow ("Followed by …").
 */
export default function SuggestedPeople() {
  const { user } = useAuth()
  const [people, setPeople] = useState(null)
  const [state, setState] = useState({})        // author_id -> 'busy' | 'following'

  useEffect(() => {
    if (!user?.authorId) return undefined
    let cancelled = false
    const run = async () => {
      try {
        const [following, followers] = await Promise.all([
          postService.getFollowList(user.authorId, 'following', 1, 100),
          postService.getFollowList(user.authorId, 'followers', 1, 100),
        ])
        const followingIds = new Set(following.map(u => u.author_id))
        const skip = dismissed()
        const out = new Map()
        for (const u of followers) {
          if (!followingIds.has(u.author_id) && !skip.has(u.author_id)) out.set(u.author_id, { ...u, reason: 'Follows you', score: 100 })
        }
        const lists = await Promise.all(following.slice(0, SAMPLE).map(f =>
          postService.getFollowList(f.author_id, 'following', 1, 50).then(list => [f, list]).catch(() => [f, []])))
        for (const [via, list] of lists) {
          for (const u of list) {
            if (u.author_id === user.authorId || followingIds.has(u.author_id) || skip.has(u.author_id)) continue
            const entry = out.get(u.author_id) || { ...u, via: [], score: 0 }
            if (entry.reason === 'Follows you') continue
            entry.via = [...(entry.via || []), via.username]
            entry.score += 1
            entry.reason = `Followed by ${entry.via[0]}${entry.via.length > 1 ? ` + ${entry.via.length - 1} more` : ''}`
            out.set(u.author_id, entry)
          }
        }
        if (!cancelled) setPeople([...out.values()].sort((a, b) => b.score - a.score).slice(0, SHOW))
      } catch {
        if (!cancelled) setPeople([])
      }
    }
    run()
    return () => { cancelled = true }
  }, [user?.authorId])

  const follow = async person => {
    setState(prev => ({ ...prev, [person.author_id]: 'busy' }))
    try {
      await postService.followUser(person.author_id)
      setState(prev => ({ ...prev, [person.author_id]: 'following' }))
    } catch {
      setState(prev => ({ ...prev, [person.author_id]: undefined }))
    }
  }

  const dismiss = person => {
    const skip = dismissed()
    skip.add(person.author_id)
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...skip])) } catch { /* memory only */ }
    setPeople(prev => prev.filter(p => p.author_id !== person.author_id))
  }

  if (!people || people.length === 0) return null
  return (
    <Card className="p-4 border border-white/10">
      <h3 className="text-sm font-semibold text-on-surface-muted mb-3">Suggested for you</h3>
      <ul className="flex flex-col gap-3">
        {people.map(p => (
          <li key={p.author_id} className="flex items-center gap-2.5">
            <Link to={`/profile/${p.username}`} className="flex items-center gap-2.5 min-w-0 flex-1">
              <img src={postService.avatarFor(p)} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-on-surface truncate">{p.username}</span>
                <span className="block text-[11px] text-on-surface-muted truncate">{p.reason}</span>
              </span>
            </Link>
            {state[p.author_id] === 'following'
              ? <span className="text-xs font-semibold text-on-surface-muted">Following</span>
              : <button onClick={() => follow(p)} disabled={state[p.author_id] === 'busy'} className="text-xs font-bold text-primary disabled:opacity-50">Follow</button>}
            <button onClick={() => dismiss(p)} aria-label={`Dismiss ${p.username}`} className="text-on-surface-muted hover:text-on-surface"><span className="material-symbols-outlined text-[16px]">close</span></button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
