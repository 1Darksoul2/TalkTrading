import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import TabBar from '../components/ui/TabBar'
import { useAuth } from '../context/AuthContext'
import { postService } from '../services/postService'
import { storyService } from '../services/storyService'
import { reelService } from '../services/reelService'
import { getSymbols } from '../services/chartService'
import { useLiveQuotes } from '../hooks/useLiveQuotes'
import { DEFAULT_AVATAR } from '../utils/defaultAvatar'

const TYPES = [
  { id: 'post', label: 'Post' },
  { id: 'story', label: 'Story' },
  { id: 'reel', label: 'Reel' },
]

// Per-type rules: what media is accepted, how many files, and where to go after sharing
const RULES = {
  post: { accept: 'image/*', maxFiles: 4, maxText: 500, mediaRequired: false, redirect: '/', hint: 'Up to 4 images' },
  story: { accept: 'image/*,video/*', maxFiles: 1, maxText: 120, mediaRequired: true, redirect: '/', hint: 'One photo or video, 9:16 works best' },
  reel: { accept: 'video/*', maxFiles: 1, maxText: 300, mediaRequired: true, redirect: '/reels', hint: 'One vertical video, up to 3 min' },
}

const SENTIMENTS = [
  { id: 'bullish', label: 'Bullish', icon: 'trending_up', active: 'bg-bullish/15 text-bullish border-bullish/40' },
  { id: 'bearish', label: 'Bearish', icon: 'trending_down', active: 'bg-bearish/15 text-bearish border-bearish/40' },
  { id: 'neutral', label: 'Neutral', icon: 'trending_flat', active: 'bg-primary/10 text-primary border-primary/40' },
]

const MAX_TICKERS = 3
const MAX_REEL_SECONDS = 180

// Duration, size and a poster frame for a reel, read in the browser before upload.
// A browser that cannot decode the codec may never answer, so every step has a deadline:
// without metadata the file is refused; without a decodable frame the reel goes up without a poster.
function inspectVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    let info = null
    let settled = false
    const timers = []
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      timers.forEach(clearTimeout)
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      fn(value)
    }
    const unreadable = () => finish(reject, new Error('This browser cannot read this video. Try an MP4 (H.264) or WebM file.'))
    video.onerror = unreadable
    timers.push(setTimeout(unreadable, 15000))
    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return unreadable()
      info = { duration: video.duration, width: video.videoWidth || null, height: video.videoHeight || null, poster: null }
      timers.push(setTimeout(() => finish(resolve, info), 5000))
      video.currentTime = Math.min(1, video.duration / 2)
    }
    video.onseeked = () => {
      if (!video.videoWidth) return finish(resolve, info)
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)
      canvas.toBlob(poster => finish(resolve, { ...info, poster }), 'image/jpeg', 0.85)
    }
    video.src = url
  })
}

function aspectRatio(w, h) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a)
  const d = gcd(w, h) || 1
  return `${w / d}:${h / d}`
}

export default function Create() {
  const [searchParams] = useSearchParams()
  const initialType = TYPES.some(t => t.id === searchParams.get('type')) ? searchParams.get('type') : 'post'
  const [type, setType] = useState(initialType)
  const [text, setText] = useState('')
  const [media, setMedia] = useState([]) // { url, kind: 'image' | 'video', name }
  const [tickers, setTickers] = useState([])
  const [tickerQuery, setTickerQuery] = useState('')
  const [sentiment, setSentiment] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [toast, setToast] = useState('')
  const [symbols, setSymbols] = useState([])
  const [profile, setProfile] = useState(null)
  const fileInput = useRef(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    getSymbols().then(data => setSymbols(data.items), err => setToast(`Tickers unavailable: ${err.message}`))
    postService.getMyProfile().then(setProfile, err => console.error('Could not load your profile:', err))
  }, [])

  const rules = RULES[type]

  // Free object URLs when media is replaced or the page unmounts
  const mediaRef = useRef(media)
  mediaRef.current = media
  useEffect(() => () => mediaRef.current.forEach(m => URL.revokeObjectURL(m.url)), [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(id)
  }, [toast])

  const clearMedia = () => {
    media.forEach(m => URL.revokeObjectURL(m.url))
    setMedia([])
  }

  const switchType = (next) => {
    if (next === type) return
    // Media accepted by one type may not suit another, so start fresh
    clearMedia()
    setText(t => t.slice(0, RULES[next].maxText))
    setType(next)
  }

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || [])
    const accepted = files.filter(f =>
      rules.accept.split(',').some(a => f.type.startsWith(a.replace('*', '')))
    )
    if (accepted.length < files.length) setToast(type === 'reel' ? 'Reels need a video file' : 'That file type isn\'t supported')
    if (!accepted.length) return

    const next = accepted.map(f => ({
      file: f,
      url: URL.createObjectURL(f),
      kind: f.type.startsWith('video') ? 'video' : 'image',
      name: f.name,
    }))

    if (rules.maxFiles === 1) {
      clearMedia()
      setMedia(next.slice(0, 1))
    } else {
      const room = rules.maxFiles - media.length
      if (next.length > room) {
        setToast(`You can add up to ${rules.maxFiles} images`)
        next.slice(room).forEach(m => URL.revokeObjectURL(m.url))
      }
      setMedia(prev => [...prev, ...next.slice(0, room)])
    }
  }

  const removeMedia = (url) => {
    URL.revokeObjectURL(url)
    setMedia(prev => prev.filter(m => m.url !== url))
  }

  const tickerMatches = tickerQuery.trim()
    ? symbols
        .filter(t => !tickers.includes(t.symbol))
        .filter(t =>
          t.symbol.toLowerCase().includes(tickerQuery.trim().toLowerCase()) ||
          t.name.toLowerCase().includes(tickerQuery.trim().toLowerCase())
        )
        .slice(0, 5)
    : []
  const matchQuotes = Object.fromEntries(useLiveQuotes(tickerMatches.map(t => t.symbol)).quotes.map(q => [q.symbol, q]))

  const addTicker = (symbol) => {
    if (tickers.length >= MAX_TICKERS) return
    setTickers(prev => [...prev, symbol])
    setTickerQuery('')
  }

  const canShare = !sharing &&
    (rules.mediaRequired ? media.length > 0 : text.trim().length > 0 || media.length > 0)

  const publishPost = () => {
    // Tickers and sentiment travel in the caption, where the feed and hashtag pages pick them up.
    const missing = tickers.filter(s => !text.toUpperCase().includes(`$${s}`))
    const tag = sentiment ? ` #${SENTIMENTS.find(s => s.id === sentiment).label}` : ''
    const caption = `${missing.map(s => `$${s}`).join(' ')}${missing.length ? ' ' : ''}${text.trim()}${tag}`.trim()
    return postService.createPostWithMedia({ caption }, media.map(m => m.file))
  }

  const publishStory = async () => {
    const uploaded = await storyService.uploadMedia(media[0].file).promise
    return storyService.createStory({ media_id: uploaded.media_id, caption: text.trim() || null })
  }

  const publishReel = async () => {
    const file = media[0].file
    const info = await inspectVideo(file)
    if (info.duration > MAX_REEL_SECONDS) throw new Error('Reels can be up to 3 minutes long.')
    const uploaded = await reelService.upload(file, info.poster)
    return reelService.create({
      caption: text.trim() || null,
      tags: tickers,
      media: {
        video_url: uploaded.video_url,
        thumbnail_url: uploaded.thumbnail_url,
        duration: Math.max(0.1, Number(info.duration.toFixed(2))),
        ...(info.width && info.height
          ? { width: info.width, height: info.height, aspect_ratio: aspectRatio(info.width, info.height) }
          : {}),
        file_size_bytes: uploaded.file_size_bytes,
        mime_type: uploaded.mime_type,
      },
    })
  }

  const share = async () => {
    if (!canShare) return
    setSharing(true)
    try {
      await { post: publishPost, story: publishStory, reel: publishReel }[type]()
      setToast(`${TYPES.find(t => t.id === type).label} shared`)
      setTimeout(() => navigate(rules.redirect), 900)
    } catch (err) {
      setToast(err.message)
      setSharing(false)
    }
  }

  const displayName = profile?.display_name || user?.username || ''
  const username = user?.username || ''

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Create</h1>
          <p className="text-sm text-on-surface-muted">Share a post, a story or a reel with the community</p>
        </div>
        <Button variant="ghost" size="sm" icon="close" onClick={() => navigate(-1)}>Cancel</Button>
      </div>

      <div className="max-w-md mb-6">
        <TabBar tabs={TYPES} activeTab={type} onChange={switchType} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor */}
        <Card className="lg:col-span-7 p-5 flex flex-col gap-5">
          {/* Media */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface-muted">
                {type === 'reel' ? 'Video' : 'Media'}{rules.mediaRequired ? '' : ' (optional)'}
              </h2>
              <span className="text-xs text-on-surface-muted">{rules.hint}</span>
            </div>

            {media.length > 0 && (
              <div className={`grid gap-2 mb-2 ${rules.maxFiles > 1 ? 'grid-cols-4' : 'grid-cols-1'}`}>
                {media.map(m => (
                  <div key={m.url} className={`relative rounded-lg overflow-hidden bg-black ${rules.maxFiles > 1 ? 'aspect-square' : 'aspect-video'}`}>
                    {m.kind === 'video'
                      ? <video src={m.url} className="w-full h-full object-contain" muted />
                      : <img src={m.url} alt={m.name} className="w-full h-full object-cover" />}
                    <button
                      onClick={() => removeMedia(m.url)}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      aria-label={`Remove ${m.name}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {media.length < rules.maxFiles && (
              <button
                onClick={() => fileInput.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
                className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border border-dashed border-outline-variant text-on-surface-muted hover:border-primary/60 hover:text-on-surface transition-all"
              >
                <span className="material-symbols-outlined text-[32px] text-primary">
                  {type === 'reel' ? 'video_call' : type === 'story' ? 'add_a_photo' : 'add_photo_alternate'}
                </span>
                <span className="text-sm font-semibold">
                  {media.length ? 'Add more' : 'Click to upload or drag a file here'}
                </span>
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={rules.accept}
              multiple={rules.maxFiles > 1}
              className="hidden"
              onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
            />
          </section>

          {/* Caption */}
          <section>
            <label htmlFor="create-text" className="block text-xs font-semibold uppercase tracking-wider text-on-surface-muted mb-2">
              {type === 'post' ? 'What\'s your take?' : 'Caption'}
            </label>
            <textarea
              id="create-text"
              value={text}
              onChange={e => setText(e.target.value.slice(0, rules.maxText))}
              rows={type === 'post' ? 5 : 3}
              placeholder={type === 'post'
                ? 'Share your analysis, a trade idea or market news… use $TICKER to mention a stock'
                : 'Add a caption…'}
              className="w-full resize-none rounded-xl bg-surface-container border border-white/[0.06] px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-primary/60"
            />
            <div className="text-right text-xs text-on-surface-muted mt-1">{text.length}/{rules.maxText}</div>
          </section>

          {/* Tickers */}
          {type !== 'story' && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface-muted mb-2">
                Tag tickers <span className="normal-case tracking-normal">(up to {MAX_TICKERS})</span>
              </h2>
              {tickers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {tickers.map(s => (
                    <span key={s} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono font-semibold">
                      ${s}
                      <button onClick={() => setTickers(prev => prev.filter(x => x !== s))} aria-label={`Remove ${s}`} className="flex">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {tickers.length < MAX_TICKERS && (
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-muted">search</span>
                  <input
                    value={tickerQuery}
                    onChange={e => setTickerQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && tickerMatches[0]) { e.preventDefault(); addTicker(tickerMatches[0].symbol) } }}
                    placeholder="Search AAPL, Bitcoin, EUR/USD…"
                    className="w-full rounded-xl bg-surface-container border border-white/[0.06] pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-primary/60"
                  />
                  {tickerMatches.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-xl bg-surface-container-high border border-white/[0.06] shadow-lg overflow-hidden">
                      {tickerMatches.map(t => (
                        <button
                          key={t.symbol}
                          onClick={() => addTicker(t.symbol)}
                          className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-white/5"
                        >
                          <span>
                            <span className="font-mono font-semibold text-sm text-on-surface">{t.symbol}</span>
                            <span className="ml-2 text-xs text-on-surface-muted">{t.name}</span>
                          </span>
                          {matchQuotes[t.symbol]?.change_percent != null && (
                            <span className={`text-xs font-mono ${matchQuotes[t.symbol].change_percent >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                              {matchQuotes[t.symbol].change_percent >= 0 ? '+' : ''}{matchQuotes[t.symbol].change_percent.toFixed(2)}%
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Sentiment */}
          {type === 'post' && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface-muted mb-2">Sentiment (optional)</h2>
              <div className="flex flex-wrap gap-2">
                {SENTIMENTS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSentiment(prev => prev === s.id ? null : s.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                      sentiment === s.id ? s.active : 'border-white/[0.08] text-on-surface-muted hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="flex justify-end pt-1">
            <Button onClick={share} disabled={!canShare} className="disabled:opacity-40 disabled:pointer-events-none" icon={sharing ? 'hourglass_top' : 'send'}>
              {sharing ? 'Sharing…' : `Share ${TYPES.find(t => t.id === type).label.toLowerCase()}`}
            </Button>
          </div>
        </Card>

        {/* Preview */}
        <div className="lg:col-span-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface-muted mb-2">Preview</h2>
          {type === 'post' ? (
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <img src={profile ? postService.avatarFor(profile) : DEFAULT_AVATAR} alt="" className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <div className="text-sm font-semibold text-on-surface">{displayName}</div>
                  <div className="text-xs text-on-surface-muted">@{username} · now</div>
                </div>
                {sentiment && (
                  <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${SENTIMENTS.find(s => s.id === sentiment).active}`}>
                    <span className="material-symbols-outlined text-[14px]">{SENTIMENTS.find(s => s.id === sentiment).icon}</span>
                    {SENTIMENTS.find(s => s.id === sentiment).label}
                  </span>
                )}
              </div>
              <p className={`text-sm whitespace-pre-wrap break-words mb-3 ${text ? 'text-on-surface' : 'text-on-surface-muted italic'}`}>
                {text || 'Your post text will appear here'}
              </p>
              {media.length > 0 && (
                <div className={`grid gap-1 rounded-lg overflow-hidden mb-3 ${media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {media.map(m => <img key={m.url} src={m.url} alt="" className="w-full aspect-[4/3] object-cover" />)}
                </div>
              )}
              {tickers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tickers.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-md bg-surface-container text-xs font-mono text-on-surface">${s}</span>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <div className="relative mx-auto w-full max-w-[280px] aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-white/[0.06]">
              {media[0] ? (
                media[0].kind === 'video'
                  ? <video src={media[0].url} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                  : <img src={media[0].url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40">
                  <span className="material-symbols-outlined text-[40px]">{type === 'reel' ? 'smart_display' : 'auto_stories'}</span>
                  <span className="text-xs">Your {type} will appear here</span>
                </div>
              )}
              {type === 'story' && (
                <div className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/60 to-transparent">
                  <div className="h-0.5 rounded-full bg-white/40 mb-2"><div className="h-full w-1/3 rounded-full bg-white" /></div>
                  <div className="text-xs font-semibold text-white">{username}</div>
                </div>
              )}
              {(text || tickers.length > 0) && (
                <div className="absolute bottom-0 inset-x-0 p-3 pt-10 bg-gradient-to-t from-black/80 to-transparent text-white">
                  {type === 'reel' && <div className="text-xs font-semibold mb-1">@{username}</div>}
                  {text && <p className={`text-xs break-words ${type === 'story' ? 'text-center text-sm font-semibold' : 'line-clamp-3'}`}>{text}</p>}
                  {tickers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {tickers.map(s => <span key={s} className="px-2 py-0.5 rounded bg-white/15 text-[11px] font-mono">${s}</span>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
