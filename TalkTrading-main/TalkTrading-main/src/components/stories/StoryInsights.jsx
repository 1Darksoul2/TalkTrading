import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { storyService } from '../../services/storyService'
import { postService } from '../../services/postService'
import { timeAgo, timeLeft } from '../../utils/time'

const BASE_TABS = [['viewers', 'Viewers'], ['replies', 'Replies'], ['overview', 'Overview']]

function Person({ user, children }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <img src={postService.avatarFor(user)} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
      <div className="min-w-0 flex-1">
        <Link to={`/profile/${user?.username || ''}`} className="text-sm font-semibold text-on-surface hover:underline truncate block">
          {user?.username || 'Unknown user'}
        </Link>
        {children}
      </div>
    </li>
  )
}

// Owner-only: who watched the story, what they said, and the numbers.
export default function StoryInsights({ story, onClose }) {
  const [tab, setTab] = useState('viewers')
  const [data, setData] = useState({ viewers: null, replies: null, overview: null, answers: null })
  const hasQuestion = story.overlays?.some(o => o.type === 'question')
  const TABS = hasQuestion ? [...BASE_TABS.slice(0, 2), ['answers', 'Answers'], BASE_TABS[2]] : BASE_TABS
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [viewers, replies, overview, answers] = await Promise.all([
          storyService.viewers(story.id), storyService.replies(story.id), storyService.analytics(story.id),
          hasQuestion ? storyService.questionAnswers(story.id) : Promise.resolve(null),
        ])
        if (!cancelled) setData({ viewers, replies, overview, answers })
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    return () => { cancelled = true }
  }, [story.id, hasQuestion])

  const { viewers, replies, overview, answers } = data
  const sticker = overview?.sticker
  const stickerDef = story.overlays?.find(o => ['slider', 'quiz', 'countdown'].includes(o.type))
  const loading = !error && viewers === null

  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full max-h-[75%] bg-surface-card rounded-t-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pt-3">
          <h3 className="font-bold text-on-surface">Story insights</h3>
          <button onClick={onClose} aria-label="Close insights" className="p-1 text-on-surface-muted hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex gap-1 px-4 pt-2 border-b border-white/10">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px ${tab === id ? 'border-primary text-primary' : 'border-transparent text-on-surface-muted'}`}
            >
              {label}{id === 'viewers' && viewers ? ` (${viewers.length})` : ''}{id === 'replies' && replies ? ` (${replies.length})` : ''}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-4 py-2 flex-1">
          {error && <p className="text-sm text-error py-6 text-center">{error}</p>}
          {loading && <p className="text-sm text-on-surface-muted py-6 text-center">Loading…</p>}

          {tab === 'viewers' && viewers && (viewers.length === 0
            ? <p className="text-sm text-on-surface-muted py-6 text-center">No one has viewed this story yet.</p>
            : <ul>{viewers.map(v => (
                <Person key={v.viewer_id} user={v.user}>
                  <p className="text-xs text-on-surface-muted">{timeAgo(v.viewed_at)}{v.replied ? ' · replied' : ''}</p>
                </Person>
              ))}</ul>)}
          {tab === 'viewers' && viewers && viewers.some(v => v.reaction) && (
            <p className="text-[11px] text-on-surface-muted pb-2">Reactions: {viewers.filter(v => v.reaction).map(v => `${v.user?.username || '?'} ${v.reaction}`).join(' · ')}</p>
          )}

          {tab === 'replies' && replies && (replies.length === 0
            ? <p className="text-sm text-on-surface-muted py-6 text-center">No replies yet.</p>
            : <ul>{replies.map(r => (
                <Person key={r.id} user={r.user}>
                  <p className="text-sm text-on-surface break-words">{r.text}</p>
                  <p className="text-[11px] text-on-surface-muted">{timeAgo(r.created_at)}</p>
                </Person>
              ))}</ul>)}

          {tab === 'answers' && answers && (answers.length === 0
            ? <p className="text-sm text-on-surface-muted py-6 text-center">No answers yet.</p>
            : <ul>{answers.map((a, i) => (
                <Person key={i} user={a.user}>
                  <p className="text-sm text-on-surface break-words">{a.value}</p>
                  <p className="text-[11px] text-on-surface-muted">{timeAgo(a.created_at)}</p>
                </Person>
              ))}</ul>)}

          {tab === 'overview' && overview && sticker && stickerDef && (
            <div className="rounded-xl bg-surface-container-high py-3 px-3 mt-3 text-center">
              <p className="text-[11px] uppercase tracking-wider text-on-surface-muted mb-1">{stickerDef.type}</p>
              {stickerDef.type === 'slider' && <p className="text-sm text-on-surface">{sticker.count ? `${stickerDef.emoji} average ${sticker.average}% from ${sticker.count}` : 'No answers yet'}</p>}
              {stickerDef.type === 'quiz' && <p className="text-sm text-on-surface">{stickerDef.options.map((o, i) => `${i === stickerDef.correct ? '✓ ' : ''}${o}: ${sticker.counts?.[i] ?? 0}`).join('   ·   ')}</p>}
              {stickerDef.type === 'countdown' && <p className="text-sm text-on-surface">{sticker.reminders ?? 0} people asked to be reminded</p>}
            </div>
          )}

          {tab === 'overview' && overview && (
            <dl className="grid grid-cols-2 gap-3 py-3 text-center">
              {[['Views', overview.views], ['Unique viewers', overview.unique_viewers], ['Replies', overview.replies],
                ['Link taps', overview.link_clicks]].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-surface-container-high py-3">
                  <dd className="text-xl font-bold text-on-surface">{value}</dd>
                  <dt className="text-[11px] uppercase tracking-wider text-on-surface-muted">{label}</dt>
                </div>
              ))}
              <div className="col-span-2 rounded-xl bg-surface-container-high py-3">
                <dt className="text-[11px] uppercase tracking-wider text-on-surface-muted mb-1">Reactions</dt>
                <dd className="text-sm text-on-surface">
                  {Object.keys(overview.reactions).length === 0 ? 'None yet' : Object.entries(overview.reactions).map(([e, n]) => `${e} ${n}`).join('   ')}
                </dd>
              </div>
              {overview.poll && (
                <div className="col-span-2 rounded-xl bg-surface-container-high py-3">
                  <dt className="text-[11px] uppercase tracking-wider text-on-surface-muted mb-1">Poll</dt>
                  <dd className="text-sm text-on-surface">
                    {(story.overlays.find(o => o.type === 'poll')?.options || []).map((o, i) => `${o}: ${overview.poll.counts[i]}`).join('   ·   ')}
                  </dd>
                </div>
              )}
              <p className="col-span-2 text-xs text-on-surface-muted">{timeLeft(overview.expires_at)}</p>
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}
