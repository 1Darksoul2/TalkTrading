import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/ui/Card'
import mockReels from '../data/mockReels'
import mockTickers from '../data/mockTickers'

const tickerBySymbol = Object.fromEntries(mockTickers.map(t => [t.symbol, t]))

function formatCount(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n)
}

function formatChange(pct) {
  return `${pct >= 0 ? '+' : ''}${pct}%`
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

function ReelActions({ reel, liked, saved, onLike, onSave, onShare, overlay }) {
  const tone = overlay ? 'text-white drop-shadow-md' : 'text-on-surface'
  const item = `flex flex-col items-center gap-1 text-xs font-medium ${tone}`
  const btn = overlay
    ? 'p-1 hover:opacity-80 transition-opacity'
    : 'w-11 h-11 rounded-full flex items-center justify-center bg-surface-container-high hover:bg-surface-container-highest transition-colors'

  return (
    <div className="flex flex-col items-center gap-5">
      <div className={item}>
        <button className={btn} onClick={onLike} aria-label={liked ? 'Unlike' : 'Like'}>
          <Icon name="favorite" filled={liked} className={`text-[26px] ${liked ? 'text-bearish' : ''}`} />
        </button>
        {formatCount(reel.likes - (reel.isLiked ? 1 : 0) + (liked ? 1 : 0))}
      </div>
      <div className={item}>
        <button className={btn} aria-label="Comments">
          <Icon name="chat_bubble" className="text-[24px]" />
        </button>
        {formatCount(reel.comments)}
      </div>
      <div className={item}>
        <button className={btn} onClick={onSave} aria-label={saved ? 'Remove from saved' : 'Save'}>
          <Icon name="bookmark" filled={saved} className={`text-[26px] ${saved ? 'text-primary' : ''}`} />
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

function ReelItem({ reel, index, active, muted, onToggleMute, paused, onTogglePause, onShare }) {
  const videoRef = useRef(null)
  const progressRef = useRef(null)
  const [liked, setLiked] = useState(reel.isLiked)
  const [saved, setSaved] = useState(reel.isSaved)
  const [following, setFollowing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (active && !paused) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [active, paused])

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

  const actions = {
    reel, liked, saved,
    onLike: () => setLiked(l => !l),
    onSave: () => setSaved(s => !s),
    onShare: () => onShare(reel),
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
            poster={reel.poster}
            className="w-full h-full object-cover cursor-pointer"
            muted={muted}
            loop
            playsInline
            preload="metadata"
            onClick={onTogglePause}
            onTimeUpdate={handleTimeUpdate}
          >
            {reel.sources.map(src => (
              <source key={src} src={src} type={`video/${src.split('.').pop()}`} />
            ))}
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
              onClick={onTogglePause}
              className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/50 text-white flex items-center justify-center"
              aria-label="Play"
            >
              <Icon name="play_arrow" filled className="text-[40px]" />
            </button>
          )}

          {/* Mobile actions sit on the video */}
          <div className="md:hidden absolute right-3 bottom-28">
            <ReelActions {...actions} overlay />
          </div>

          {/* Author, caption, tickers */}
          <div className="absolute inset-x-0 bottom-0 pt-16 pb-5 px-4 pr-16 md:pr-4 bg-gradient-to-t from-black/85 via-black/50 to-transparent text-white">
            <div className="flex items-center gap-2 mb-2">
              <Link to={`/profile/${reel.username}`} className="flex items-center gap-2 min-w-0">
                <img src={reel.userAvatar} alt={reel.displayName} className="w-8 h-8 rounded-full object-cover border border-white/20" />
                <span className="font-semibold text-sm truncate">{reel.username}</span>
                {reel.isVerified && (
                  <Icon name="verified" filled className="text-[16px] text-primary" />
                )}
              </Link>
              <span className="text-white/60 text-xs">· {reel.timestamp}</span>
              <button
                onClick={() => setFollowing(f => !f)}
                className={`ml-1 px-3 py-0.5 rounded-md text-xs font-semibold border transition-colors ${
                  following ? 'border-white/30 text-white/80' : 'border-white/60 hover:bg-white/10'
                }`}
              >
                {following ? 'Following' : 'Follow'}
              </button>
            </div>

            <p
              className={`text-sm text-white/90 leading-snug ${expanded ? '' : 'line-clamp-2'} cursor-pointer`}
              onClick={() => setExpanded(e => !e)}
            >
              {reel.caption}
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              {reel.tickers.map(symbol => {
                const t = tickerBySymbol[symbol]
                return (
                  <Link
                    key={symbol}
                    to={`/market/${symbol}`}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 border border-white/15 font-mono text-xs hover:border-primary/60 transition-colors"
                  >
                    <span>${symbol}</span>
                    {t && (
                      <span className={t.changePercent >= 0 ? 'text-bullish' : 'text-bearish'}>
                        {formatChange(t.changePercent)}
                      </span>
                    )}
                    <Icon name="chevron_right" className="text-[14px] text-white/60" />
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Progress */}
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15">
            <div ref={progressRef} className="h-full bg-primary" style={{ width: 0 }} />
          </div>
        </div>

        {/* Desktop actions sit beside the video */}
        <div className="hidden md:block pb-6">
          <ReelActions {...actions} />
        </div>
      </div>
    </section>
  )
}

export default function Reels() {
  const scrollerRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const [paused, setPaused] = useState(false)
  const [toast, setToast] = useState('')

  // Whichever reel fills most of the viewport is the one that plays
  useEffect(() => {
    const scroller = scrollerRef.current
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
  }, [])

  const goTo = useCallback(index => {
    const target = scrollerRef.current?.querySelector(`section[data-index="${index}"]`)
    target?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onKey = e => {
      if (e.target.closest('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        goTo(Math.min(activeIndex + 1, mockReels.length - 1))
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
  }, [activeIndex, goTo])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(id)
  }, [toast])

  const handleShare = reel => {
    const url = `${window.location.origin}/reels#${reel.id}`
    navigator.clipboard?.writeText(url).then(
      () => setToast('Link copied'),
      () => setToast('Could not copy link')
    )
  }

  const activeReel = mockReels[activeIndex]

  return (
    <div className="flex justify-center gap-10 md:px-6">
      <div
        ref={scrollerRef}
        className="h-[calc(100dvh-9rem)] md:h-[calc(100dvh-4rem)] w-full md:w-auto overflow-y-auto snap-y snap-mandatory hide-scrollbar"
      >
        {mockReels.map((reel, i) => (
          <ReelItem
            key={reel.id}
            reel={reel}
            index={i}
            active={i === activeIndex}
            muted={muted}
            onToggleMute={() => setMuted(m => !m)}
            paused={paused}
            onTogglePause={() => setPaused(p => !p)}
            onShare={handleShare}
          />
        ))}
      </div>

      {/* Desktop side panel */}
      <aside className="hidden lg:flex flex-col gap-4 w-72 pt-4">
        <Card className="p-4">
          <h3 className="font-semibold text-on-surface border-b border-outline-variant/30 pb-2 mb-3">In this reel</h3>
          <div className="flex flex-col gap-2">
            {activeReel.tickers.map(symbol => {
              const t = tickerBySymbol[symbol]
              return (
                <Link key={symbol} to={`/market/${symbol}`} className="flex justify-between items-center hover:bg-white/5 rounded-lg px-2 py-1 transition-colors">
                  <div className="flex flex-col">
                    <span className="font-mono text-sm text-on-surface">${symbol}</span>
                    {t && <span className="text-xs text-on-surface-muted">{t.name}</span>}
                  </div>
                  {t && (
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-sm text-on-surface">{t.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <span className={`font-mono text-xs ${t.changePercent >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                        {formatChange(t.changePercent)}
                      </span>
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

        <div className="px-1 text-xs text-on-surface-muted leading-relaxed">
          <p><kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd> next reel · <kbd className="font-mono">Space</kbd> pause · <kbd className="font-mono">M</kbd> mute</p>
          <p className="mt-1">{activeIndex + 1} of {mockReels.length}</p>
        </div>
      </aside>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
