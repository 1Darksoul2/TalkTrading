import { Link } from 'react-router-dom'
import { CountdownSticker, PostSticker, QuestionSticker, QuizSticker, SliderSticker } from './StickerViews'

function place(o) {
  return {
    left: `${o.x * 100}%`,
    top: `${o.y * 100}%`,
    transform: `translate(-50%, -50%) scale(${o.scale || 1}) rotate(${o.rotation || 0}deg)`,
  }
}

export function PollSticker({ overlay, poll, canVote, onVote }) {
  const total = poll?.total || 0
  const showResults = Boolean(poll)
  return (
    <div className="w-56 rounded-2xl bg-white/95 text-neutral-900 p-3 shadow-xl">
      <p className="text-sm font-bold text-center mb-2 break-words">{overlay.question}</p>
      <div className="flex flex-col gap-1.5">
        {overlay.options.map((label, i) => {
          const pct = showResults && total ? Math.round((poll.counts[i] / total) * 100) : 0
          const mine = showResults && poll.my_vote === i
          return (
            <button
              key={i}
              disabled={!canVote || showResults}
              onClick={() => onVote?.(i)}
              className={`relative overflow-hidden rounded-lg border text-sm font-semibold py-1.5 px-2 text-left ${mine ? 'border-primary' : 'border-neutral-300'} disabled:cursor-default`}
            >
              {showResults && <span className="absolute inset-y-0 left-0 bg-primary/40" style={{ width: `${pct}%` }} />}
              <span className="relative flex justify-between gap-2">
                <span className="truncate">{label}</span>
                {showResults && <span>{pct}%</span>}
              </span>
            </button>
          )
        })}
      </div>
      {showResults && <p className="text-[11px] text-neutral-500 text-center mt-1.5">{total} {total === 1 ? 'vote' : 'votes'}</p>}
    </div>
  )
}

function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

const CHIP = 'px-2.5 py-1 rounded-lg bg-white/90 text-neutral-900 text-sm font-bold'

/** How one overlay looks (no positioning). `interactive` makes mentions, links and polls clickable. */
export function OverlayVisual({ overlay: o, story, interactive = false, owner = false, actions = {} }) {
  const { onLinkClick, onVote } = actions
  const sticker = { overlay: o, state: story?.sticker, interactive: interactive && Boolean(story) && !story.expired, owner }
  if (o.type === 'question') return <QuestionSticker {...sticker} onAnswer={actions.onQuestion} onFocusChange={actions.onFocusChange} />
  if (o.type === 'slider') return <SliderSticker {...sticker} onAnswer={actions.onSlider} />
  if (o.type === 'quiz') return <QuizSticker {...sticker} onAnswer={actions.onQuiz} />
  if (o.type === 'countdown') return <CountdownSticker {...sticker} onRemind={actions.onRemind} />
  if (o.type === 'post') return <PostSticker overlay={o} interactive={interactive} />
  if (o.type === 'text') {
    return (
      <span style={{ color: o.color, background: o.background || 'transparent' }}
        className="block px-2 py-1 rounded-md text-xl font-bold text-center break-words drop-shadow-lg">
        {o.text}
      </span>
    )
  }
  if (o.type === 'mention') {
    const chip = <span className={CHIP}>@{o.username}</span>
    return interactive ? <Link to={`/profile/${o.username}`}>{chip}</Link> : chip
  }
  if (o.type === 'hashtag') {
    const chip = <span className={CHIP}>#{o.tag}</span>
    return interactive ? <Link to={`/explore?hashtag=${encodeURIComponent(o.tag)}`}>{chip}</Link> : chip
  }
  if (o.type === 'link') {
    const chip = (
      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/95 text-neutral-900 text-sm font-bold shadow-lg">
        <span className="material-symbols-outlined text-[16px]">link</span>{o.label || host(o.url)}
      </span>
    )
    return interactive
      ? <a href={o.url} target="_blank" rel="noopener noreferrer nofollow" onClick={() => onLinkClick?.(story)}>{chip}</a>
      : chip
  }
  if (o.type === 'poll') {
    return <PollSticker overlay={o} poll={story?.poll} canVote={interactive && story && !story.expired} onVote={onVote} />
  }
  return null
}

/** All overlays of a story, positioned over the frame. Only the interactive ones accept taps. */
export default function StoryOverlays({ overlays = [], story, interactive = false, owner = false, actions = {} }) {
  return overlays.map((o, i) => (
    <div
      key={i}
      style={place(o)}
      className={`absolute max-w-[85%] ${interactive && o.type !== 'text' ? 'pointer-events-auto' : 'pointer-events-none'}`}
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
    >
      <OverlayVisual overlay={o} story={story} interactive={interactive} owner={owner} actions={actions} />
    </div>
  ))
}
