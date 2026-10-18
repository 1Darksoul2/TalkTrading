import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/ui/Card'
import { reelService } from '../services/reelService'
import { postService } from '../services/postService'
import { getSymbols } from '../services/chartService'
import { useLiveQuotes } from '../hooks/useLiveQuotes'
import { useAuth } from '../context/AuthContext'
import { deriveAuthorId } from '../utils/authorId'
import { DEFAULT_AVATAR } from '../utils/defaultAvatar'
import { timeAgo } from '../utils/time'
import { copyText } from '../utils/clipboard'

const PAGE_SIZE = 8

function formatCount(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n)
}

function formatChange(pct) {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

function Icon({ name, filled = false, className = '' }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : {}}
    >
      {name}
    </span>
  )
}

// A feed item from the Reel Service, plus the author's profile from the Post Service.
function toReel(r, people) {
  const authorId = deriveAuthorId(r.user_id)
  const person = people[authorId]
  return {
    id: r.id,
    userId: r.user_id,
    authorId,
    username: person?.username || '',
    displayName: person?.display_name || person?.username || '',
    userAvatar: person ? postService.avatarFor(person) : DEFAULT_AVATAR,
    videoUrl: reelService.mediaUrl(r.media?.video_url),
    mimeType: r.media?.mime_type || 'video/mp4',
    poster: reelService.mediaUrl(r.media?.thumbnail_url),
    caption: r.caption || '',
    tickers: (r.tags || '').split(',').map(t => t.trim().toUpperCase()).filter(Boolean),
    likes: r.likes_count,
    comments: r.comments_count,
    timestamp: timeAgo(r.created_at),
    isLiked: Boolean(r.is_liked),
    isSaved: Boolean(r.is_bookmarked),
  }
}

async function withAuthors(rawReels) {
  const people = await postService.lookupUsers(rawReels.map(r => deriveAuthorId(r.user_id)))
  return rawReels.map(r => toReel(r, people))
}

function ReelActions({ reel, onLike, onSave, onComments, onShare, overlay }) {
  const tone = overlay ? 'text-white drop-shadow-md' : 'text-on-surface'
  const item = `flex flex-col items-center gap-1 text-xs font-medium ${tone}`
  const btn = overlay
    ? 'p-1 hover:opacity-80 transition-opacity'
    : 'w-11 h-11 rounded-full flex items-center justify-center bg-surface-container-high hover:bg-surface-container-highest transition-colors'

  return (
    <div className="flex flex-col items-center gap-5">
      <div className={item}>
        <button className={btn} onClick={onLike} aria-label={reel.isLiked ? 'Unlike' : 'Like'}>
          <Icon name="favorite" filled={reel.isLiked} className={`text-[26px] ${reel.isLiked ? 'text-bearish' : ''}`} />
        </button>
        {formatCount(reel.likes)}
      </div>
      <div className={item}>
        <button className={btn} onClick={onComments} aria-label="Comments">
          <Icon name="chat_bubble" className="text-[24px]" />
        </button>
        {formatCount(reel.comments)}
      </div>
      <div className={item}>
        <button className={btn} onClick={onSave} aria-label={reel.isSaved ? 'Remove from saved' : 'Save'}>
          <Icon name="bookmark" filled={reel.isSaved} className={`text-[26px] ${reel.isSaved ? 'text-primary' : ''}`} />
        </button>
        Save
      </div>
      <div className={item}>
        <button className={btn} onClick={onShare} aria-label="Share">
          <Icon name="send" className="text-[24px]" />
        </button>
        Share
      </div>
    </div>
  )
}

function ReelComments({ reel, onClose, onAdded, onError }) {
  const { user } = useAuth()
  const [comments, setComments] = useState(null)
  const [people, setPeople] = useState({})
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    try {
      const list = await reelService.comments(reel.id)
      const ids = list.flatMap(c => [c, ...(c.replies || [])]).map(c => deriveAuthorId(c.user_id))
      setPeople(await postService.lookupUsers(ids))
      setComments(list)
    } catch (err) {
      onError(err.message)
      setComments([])
    }
  }, [reel.id, onError])

  useEffect(() => { load() }, [load])

  const send = async e => {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await reelService.addComment(reel.id, text.trim())
      setText('')
      onAdded()
      await load()
    } catch (err) {
      onError(err.message)
    } finally {
      setSending(false)
    }
  }

  const remove = async id => {
    try {
      await reelService.deleteComment(id)
      onAdded(-1)
      await load()
    } catch (err) {
      onError(err.message)
    }
  }

  const row = c => {
    const person = people[deriveAuthorId(c.user_id)]
    return (
      <div key={c.id} className="flex gap-3">
        <img src={person ? postService.avatarFor(person) : DEFAULT_AVATAR} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-on-surface-muted">
            {person ? <Link to={`/profile/${person.username}`} className="font-semibold text-on-surface hover:underline">{person.username}</Link> : 'Unknown user'}
            {' · '}{timeAgo(c.created_at)}
          </div>
          <p className="text-sm text-on-surface break-words">{c.content}</p>
        </div>
        {c.user_id === user?.id && (
          <button onClick={() => remove(c.id)} className="text-on-surface-muted hover:text-bearish self-start" aria-label="Delete comment">
            <Icon name="delete" className="text-[18px]" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full md:max-w-md max-h-[75dvh] flex flex-col rounded-t-2xl md:rounded-2xl bg-surface-card border border-white/[0.06]"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Comments"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <h2 className="font-semibold text-on-surface">Comments</h2>
          <button onClick={onClose} aria-label="Close" className="text-on-surface-muted hover:text-on-surface">
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
          {comments === null && <p className="text-sm text-on-surface-muted">Loading…</p>}
          {comments?.length === 0 && <p className="text-sm text-on-surface-muted">No comments yet. Start the conversation.</p>}
          {comments?.map(c => (
            <div key={c.id} className="flex flex-col gap-3">
              {row(c)}
              {(c.replies || []).length > 0 && <div className="pl-11 flex flex-col gap-3">{c.replies.map(row)}</div>}
            </div>
          ))}
        </div>
        <form onSubmit={send} className="flex gap-2 p-3 border-t border-white/[0.06]">
          <input
            value={text}
            onChange={e => setText(e.target.value.slice(0, 1000))}
            placeholder="Add a comment…"
            className="flex-1 rounded-xl bg-surface-container border border-white/[0.06] px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-primary/60"
          />
          <button type="submit" disabled={!text.trim() || sending} className="px-4 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-40">
            Post
          </button>
        </form>
      </div>
    </div>
  )
}

function ReelItem({ reel, index, active, muted, onToggleMute, paused, onTogglePause, quotes, isOwn, following, onFollow, actions }) {
  const videoRef = useRef(null)
  const progressRef = useRef(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (active && !paused) {
      // Browsers may refuse to start playback (e.g. unmuted autoplay); the play button stays available.
      video.play().catch(() => onTogglePause(true))
    } else {
      video.pause()
    }
  }, [active, paused, onTogglePause])

  useEffect(() => {
    // Each reel starts from the beginning when you scroll back to it
    if (!active && videoRef.current) videoRef.current.currentTime = 0
  }, [active])

  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (video?.duration && progressRef.current) {
      progressRef.current.style.width = `${(video.currentTime / video.duration) * 100}%`
    }
  }

  return (
    <section
      data-index={index}
      className="h-full snap-start snap-always flex items-center justify-center md:py-4"
    >
      <div className="flex items-end gap-4 h-full w-full md:w-auto">
        <div className="relative h-full w-full md:w-auto md:aspect-[9/16] bg-black md:rounded-2xl overflow-hidden md:border md:border-white/[0.06]">
          <video
            ref={videoRef}
            poster={reel.poster || undefined}
            className="w-full h-full object-cover cursor-pointer"
            muted={muted}
            loop
            playsInline
            preload="metadata"
            onClick={() => onTogglePause()}
            onTimeUpdate={handleTimeUpdate}
          >
            <source src={reel.videoUrl} type={reel.mimeType} />
          </video>

          {/* Mute */}
          <button
            onClick={onToggleMute}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            <Icon name={muted ? 'volume_off' : 'volume_up'} className="text-[20px]" />
          </button>

          {/* Paused indicator */}
          {active && paused && (
            <button
              onClick={() => onTogglePause()}
              className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/50 text-white flex items-center justify-center"
              aria-label="Play"
            >
              <Icon name="play_arrow" filled className="text-[40px]" />
            </button>
          )}

          {/* Mobile actions sit on the video */}
          <div className="md:hidden absolute right-3 bottom-28">
            <ReelActions reel={reel} {...actions} overlay />
          </div>

          {/* Author, caption, tickers */}
          <div className="absolute inset-x-0 bottom-0 pt-16 pb-5 px-4 pr-16 md:pr-4 bg-gradient-to-t from-black/85 via-black/50 to-transparent text-white">
            <div className="flex items-center gap-2 mb-2">
              <Link to={reel.username ? `/profile/${reel.username}` : '#'} className="flex items-center gap-2 min-w-0">
                <img src={reel.userAvatar} alt={reel.displayName} className="w-8 h-8 rounded-full object-cover border border-white/20" />
                <span className="font-semibold text-sm truncate">{reel.username || 'Unknown user'}</span>
              </Link>
              <span className="text-white/60 text-xs">· {reel.timestamp}</span>
              {!isOwn && (
                <button
                  onClick={onFollow}
                  className={`ml-1 px-3 py-0.5 rounded-md text-xs font-semibold border transition-colors ${
                    following ? 'border-white/30 text-white/80' : 'border-white/60 hover:bg-white/10'
                  }`}
                >
                  {following ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {reel.caption && (
              <p
                className={`text-sm text-white/90 leading-snug ${expanded ? '' : 'line-clamp-2'} cursor-pointer`}
                onClick={() => setExpanded(e => !e)}
              >
                {reel.caption}
              </p>
            )}

            {reel.tickers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {reel.tickers.map(symbol => {
                  const q = quotes[symbol]
                  return (
                    <Link
                      key={symbol}
                      to={`/market/${symbol}`}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 border border-white/15 font-mono text-xs hover:border-primary/60 transition-colors"
                    >
                      <span>${symbol}</span>
                      {q?.change_percent != null && (
                        <span className={q.change_percent >= 0 ? 'text-bullish' : 'text-bearish'}>
                          {formatChange(q.change_percent)}
                        </span>
                      )}
                      <Icon name="chevron_right" className="text-[14px] text-white/60" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15">
            <div ref={progressRef} className="h-full bg-primary" style={{ width: 0 }} />
          </div>
        </div>

        {/* Desktop actions sit beside the video */}
        <div className="hidden md:block pb-6">
          <ReelActions reel={reel} {...actions} />
        </div>
      </div>
    </section>
  )
}

export default function Reels() {
  const { user } = useAuth()
  const scrollerRef = useRef(null)
  const [reels, setReels] = useState(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const [paused, setPaused] = useState(false)
  const [toast, setToast] = useState('')
  const [following, setFollowing] = useState({})
  const [symbolNames, setSymbolNames] = useState({})
  const [commentsFor, setCommentsFor] = useState(null)
  const viewed = useRef(new Set())

  const showError = useCallback(message => setToast(message), [])

  const loadPage = useCallback(async nextPage => {
    const items = await reelService.feed(nextPage, PAGE_SIZE)
    const organic = items.filter(i => i.type === 'organic' && i.reel).map(i => i.reel)
    const mapped = await withAuthors(organic)
    setHasMore(items.length === PAGE_SIZE)
    setPage(nextPage)
    return mapped
  }, [])

  useEffect(() => {
    loadPage(1).then(setReels, err => { setError(err.message); setReels([]) })
  }, [loadPage])

  // Names for the ticker panel, from the Chart Service's symbol list.
  useEffect(() => {
    getSymbols().then(
      data => setSymbolNames(Object.fromEntries(data.items.map(s => [s.symbol, s.name]))),
      err => console.error('Could not load symbols:', err),
    )
  }, [])

  // Whether you already follow each author on screen.
  useEffect(() => {
    if (!reels) return
    const missing = [...new Set(reels.map(r => r.authorId))].filter(id => id !== user?.authorId && !(id in following))
    if (!missing.length) return
    Promise.all(missing.map(id => postService.getFollowStats(id).then(s => [id, s.is_following])))
      .then(pairs => setFollowing(prev => ({ ...prev, ...Object.fromEntries(pairs) })), err => showError(err.message))
  }, [reels, user?.authorId, following, showError])

  const allTickers = useMemo(() => [...new Set((reels || []).flatMap(r => r.tickers))], [reels])
  const { quotes: quoteList } = useLiveQuotes(allTickers)
  const quotes = useMemo(() => Object.fromEntries(quoteList.map(q => [q.symbol, q])), [quoteList])

  // Whichever reel fills most of the viewport is the one that plays
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || !reels?.length) return
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveIndex(Number(entry.target.dataset.index))
            setPaused(false)
          }
        })
      },
      { root: scroller, threshold: 0.6 }
    )
    scroller.querySelectorAll('section[data-index]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [reels])

  // Count a view once per reel per visit, and fetch the next page near the end.
  useEffect(() => {
    const reel = reels?.[activeIndex]
    if (!reel) return
    if (!viewed.current.has(reel.id)) {
      viewed.current.add(reel.id)
      reelService.recordView(reel.id).catch(err => console.error('Could not record the view:', err))
    }
    if (hasMore && !loadingMore && activeIndex >= reels.length - 2) {
      setLoadingMore(true)
      loadPage(page + 1)
        .then(more => setReels(prev => [...prev, ...more.filter(m => !prev.some(p => p.id === m.id))]), err => showError(err.message))
        .finally(() => setLoadingMore(false))
    }
  }, [activeIndex, reels, hasMore, loadingMore, page, loadPage, showError])

  const goTo = useCallback(index => {
    const target = scrollerRef.current?.querySelector(`section[data-index="${index}"]`)
    target?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const count = reels?.length || 0
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        goTo(Math.min(activeIndex + 1, count - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        goTo(Math.max(activeIndex - 1, 0))
      } else if (e.key === ' ') {
        e.preventDefault()
        setPaused(p => !p)
      } else if (e.key === 'm' || e.key === 'M') {
        setMuted(m => !m)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeIndex, count, goTo])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(id)
  }, [toast])

  const patch = (id, changes) => setReels(prev => prev.map(r => (r.id === id ? { ...r, ...changes } : r)))

  const like = async reel => {
    try {
      const res = await reelService.toggleLike(reel.id)
      patch(reel.id, { isLiked: res.liked, likes: res.likes_count })
    } catch (err) {
      showError(err.message)
    }
  }

  const save = async reel => {
    try {
      const res = await reelService.toggleBookmark(reel.id)
      patch(reel.id, { isSaved: res.bookmarked })
      setToast(res.bookmarked ? 'Saved' : 'Removed from saved')
    } catch (err) {
      showError(err.message)
    }
  }

  const share = async reel => {
    if (!(await copyText(`${window.location.origin}/reels#${reel.id}`))) {
      showError('Could not copy link')
      return
    }
    setToast('Link copied')
    try {
      await reelService.share(reel.id)
    } catch (err) {
      showError(err.message)
    }
  }

  const follow = async reel => {
    const now = following[reel.authorId]
    try {
      if (now) await postService.unfollowUser(reel.authorId)
      else await postService.followUser(reel.authorId)
      setFollowing(prev => ({ ...prev, [reel.authorId]: !now }))
    } catch (err) {
      showError(err.message)
    }
  }

  const togglePause = useCallback(force => setPaused(p => (typeof force === 'boolean' ? force : !p)), [])

  if (reels === null) {
    return <div className="flex justify-center py-24 text-on-surface-muted text-sm">Loading reels…</div>
  }

  if (reels.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4 space-y-3">
        <span className="material-symbols-outlined text-5xl text-on-surface-muted">smart_display</span>
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-on-surface">Reels could not be loaded</h1>
            <p className="text-sm text-on-surface-muted">{error}</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-on-surface">No reels yet</h1>
            <p className="text-sm text-on-surface-muted">Be the first to share a short chart breakdown.</p>
          </>
        )}
        <Link to="/create?type=reel" className="inline-block px-5 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold">Create a reel</Link>
      </div>
    )
  }

  const activeReel = reels[activeIndex] || reels[0]

  return (
    <div className="flex justify-center gap-10 md:px-6">
      <div
        ref={scrollerRef}
        className="h-[calc(100dvh-9rem)] md:h-[calc(100dvh-4rem)] w-full md:w-auto overflow-y-auto snap-y snap-mandatory hide-scrollbar"
      >
        {reels.map((reel, i) => (
          <ReelItem
            key={reel.id}
            reel={reel}
            index={i}
            active={i === activeIndex}
            muted={muted}
            onToggleMute={() => setMuted(m => !m)}
            paused={paused}
            onTogglePause={togglePause}
            quotes={quotes}
            isOwn={reel.userId === user?.id}
            following={Boolean(following[reel.authorId])}
            onFollow={() => follow(reel)}
            actions={{
              onLike: () => like(reel),
              onSave: () => save(reel),
              onComments: () => setCommentsFor(reel),
              onShare: () => share(reel),
            }}
          />
        ))}
      </div>

      {/* Desktop side panel */}
      <aside className="hidden lg:flex flex-col gap-4 w-72 pt-4">
        {activeReel.tickers.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold text-on-surface border-b border-outline-variant/30 pb-2 mb-3">In this reel</h3>
            <div className="flex flex-col gap-2">
              {activeReel.tickers.map(symbol => {
                const q = quotes[symbol]
                return (
                  <Link key={symbol} to={`/market/${symbol}`} className="flex justify-between items-center hover:bg-white/5 rounded-lg px-2 py-1 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-mono text-sm text-on-surface">${symbol}</span>
                      {symbolNames[symbol] && <span className="text-xs text-on-surface-muted">{symbolNames[symbol]}</span>}
                    </div>
                    {q?.price != null && (
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-sm text-on-surface">{q.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        {q.change_percent != null && (
                          <span className={`font-mono text-xs ${q.change_percent >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                            {formatChange(q.change_percent)}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
            <Link
              to={`/market/${activeReel.tickers[0]}`}
              className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              Open chart <Icon name="arrow_forward" className="text-[16px]" />
            </Link>
          </Card>
        )}

        <div className="px-1 text-xs text-on-surface-muted leading-relaxed">
          <p><kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd> next reel · <kbd className="font-mono">Space</kbd> pause · <kbd className="font-mono">M</kbd> mute</p>
          <p className="mt-1">{activeIndex + 1} of {reels.length}{hasMore ? '+' : ''}</p>
        </div>
      </aside>

      {commentsFor && (
        <ReelComments
          reel={commentsFor}
          onClose={() => setCommentsFor(null)}
          onAdded={(delta = 1) => patch(commentsFor.id, { comments: Math.max(0, (reels.find(r => r.id === commentsFor.id)?.comments || 0) + delta) })}
          onError={showError}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
