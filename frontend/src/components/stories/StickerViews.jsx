import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { postService } from '../../services/postService'

const CARD = 'w-60 rounded-2xl bg-white/95 text-neutral-900 p-3 shadow-xl'

/** "Ask me a question": viewers send private answers; the owner sees how many arrived. */
export function QuestionSticker({ overlay, state, interactive, owner, onAnswer, onFocusChange }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async e => {
    e.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    try { await onAnswer(text.trim()); setText('') } finally { setBusy(false) }
  }
  return (
    <div className={CARD}>
      <p className="text-sm font-bold text-center mb-2 break-words">{overlay.prompt}</p>
      {owner ? (
        <p className="text-xs text-center text-neutral-600">{state?.answers ?? 0} {state?.answers === 1 ? 'answer' : 'answers'} · see Insights</p>
      ) : (
        <form onSubmit={send} className="flex gap-1.5">
          <input value={text} onChange={e => setText(e.target.value)} maxLength={300} disabled={!interactive} placeholder="Type something…" aria-label="Answer the question"
            onFocus={() => onFocusChange?.(true)} onBlur={() => onFocusChange?.(false)}
            className="flex-1 min-w-0 rounded-lg bg-neutral-100 px-2 py-1.5 text-sm focus:outline-none" />
          <button disabled={!interactive || !text.trim() || busy} className="px-2 rounded-lg bg-neutral-900 text-white text-xs font-bold disabled:opacity-40">Send</button>
        </form>
      )}
      {!owner && state?.my_answers > 0 && <p className="text-[11px] text-center text-neutral-600 mt-1">Sent{state.my_answers > 1 ? ` (${state.my_answers})` : ''}</p>}
    </div>
  )
}

/** Emoji slider: drag and let go to answer once; then the average appears. */
export function SliderSticker({ overlay, state, interactive, owner, onAnswer }) {
  const answered = state?.my_value !== null && state?.my_value !== undefined
  const [value, setValue] = useState(50)
  const showAverage = owner || answered
  return (
    <div className={CARD}>
      <p className="text-sm font-bold text-center mb-2 break-words">{overlay.question}</p>
      <div className="relative">
        <input type="range" min={0} max={100} value={answered ? state.my_value : value} disabled={!interactive || owner || answered}
          aria-label={overlay.question} onChange={e => setValue(Number(e.target.value))}
          onPointerUp={() => interactive && !owner && !answered && onAnswer(value)}
          onKeyUp={e => ['Enter', ' '].includes(e.key) && interactive && !owner && !answered && onAnswer(value)}
          className="w-full accent-pink-500" />
        <span className="absolute -top-5 pointer-events-none text-xl" style={{ left: `calc(${answered ? state.my_value : value}% - 10px)` }} aria-hidden>{overlay.emoji}</span>
      </div>
      {showAverage && (
        <p className="text-[11px] text-center text-neutral-600 mt-1">
          {state?.count ? `Average ${state.average}% · ${state.count} ${state.count === 1 ? 'answer' : 'answers'}` : 'No answers yet'}
        </p>
      )}
    </div>
  )
}

/** Quiz: pick an answer once; then the right one turns green (yours red if it was wrong). */
export function QuizSticker({ overlay, state, interactive, owner, onAnswer }) {
  const answered = state?.my_answer !== null && state?.my_answer !== undefined
  const reveal = owner || answered
  const total = (state?.counts || []).reduce((a, b) => a + b, 0)
  return (
    <div className={CARD}>
      <p className="text-sm font-bold text-center mb-2 break-words">{overlay.question}</p>
      <div className="flex flex-col gap-1.5">
        {overlay.options.map((label, i) => {
          const correct = reveal && state?.correct === i
          const wrongPick = answered && state.my_answer === i && !correct
          const pct = reveal && total ? Math.round(((state.counts?.[i] || 0) / total) * 100) : null
          return (
            <button key={i} disabled={!interactive || owner || answered} onClick={() => onAnswer(i)}
              className={`flex justify-between items-center rounded-lg border px-2 py-1.5 text-sm font-semibold text-left disabled:cursor-default ${correct ? 'bg-green-500 text-white border-green-500' : wrongPick ? 'bg-red-500 text-white border-red-500' : 'border-neutral-300'}`}>
              <span className="truncate">{label}</span>{pct !== null && <span className="text-xs">{pct}%</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function remaining(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return null
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return [d, h, m, s]
}

/** Countdown that ticks live; viewers can ask to be notified when it ends. */
export function CountdownSticker({ overlay, state, interactive, owner, onRemind }) {
  const [left, setLeft] = useState(() => remaining(overlay.ends_at))
  useEffect(() => {
    const timer = setInterval(() => setLeft(remaining(overlay.ends_at)), 1000)
    return () => clearInterval(timer)
  }, [overlay.ends_at])
  return (
    <div className={`${CARD} text-center`}>
      <p className="text-sm font-bold mb-1 break-words">{overlay.title}</p>
      {left ? (
        <p className="font-mono text-lg font-bold tabular-nums" aria-live="off">
          {left[0] > 0 && `${left[0]}d `}{String(left[1]).padStart(2, '0')}:{String(left[2]).padStart(2, '0')}:{String(left[3]).padStart(2, '0')}
        </p>
      ) : <p className="text-sm font-semibold text-neutral-600">Ended</p>}
      <p className="text-[11px] text-neutral-500 mb-1.5">{new Date(overlay.ends_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
      {owner ? (
        <p className="text-[11px] text-neutral-600">{state?.reminders ?? 0} {state?.reminders === 1 ? 'reminder' : 'reminders'} set</p>
      ) : left && (
        <button disabled={!interactive} onClick={() => onRemind(!state?.reminded)} aria-pressed={Boolean(state?.reminded)}
          className={`px-3 py-1 rounded-full text-xs font-bold ${state?.reminded ? 'bg-neutral-200 text-neutral-900' : 'bg-neutral-900 text-white'} disabled:opacity-50`}>
          {state?.reminded ? 'Reminder on' : 'Remind me'}
        </button>
      )}
    </div>
  )
}

/** A post shared to a story. Loaded with the viewer's own access, so a hidden post simply shows as unavailable. */
export function PostSticker({ overlay, interactive }) {
  const [post, setPost] = useState(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let cancelled = false
    postService.getPost(overlay.post_id)
      .then(p => postService.attachAuthors([p]))
      .then(([p]) => { if (!cancelled) setPost(p) })
      .catch(() => { if (!cancelled) setMissing(true) })
    return () => { cancelled = true }
  }, [overlay.post_id])

  const body = missing ? (
    <p className="p-4 text-sm text-center text-neutral-600">This post is unavailable</p>
  ) : !post ? (
    <p className="p-4 text-sm text-center text-neutral-500">Loading post…</p>
  ) : (
    <>
      <div className="flex items-center gap-2 p-2">
        <img src={post.userAvatar} alt="" className="w-6 h-6 rounded-full object-cover" />
        <span className="text-xs font-bold truncate">{post.username}</span>
      </div>
      {post.image && <img src={post.image} alt="" className="w-full aspect-square object-cover" />}
      {post.content && <p className="p-2 text-xs line-clamp-3">{post.content}</p>}
    </>
  )
  const card = <div className="w-56 rounded-xl bg-white text-neutral-900 overflow-hidden shadow-2xl">{body}</div>
  return interactive && post ? <Link to={`/p/${overlay.post_id}`} aria-label={`Open post by ${post.username}`}>{card}</Link> : card
}
