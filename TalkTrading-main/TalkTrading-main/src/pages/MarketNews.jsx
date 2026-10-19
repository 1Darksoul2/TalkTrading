import { useState, useEffect, useCallback } from 'react'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import TabBar from '../components/ui/TabBar'
import TrendingTickers from '../components/TrendingTickers'
import { newsService } from '../services/newsService'
import { timeAgo } from '../utils/time'

// The categories the News Service actually tags articles with.
const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'markets', label: 'Markets' },
  { id: 'general', label: 'General' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'forex', label: 'Forex' },
]
const PAGE = 20

function SaveButton({ saved, busy, onToggle }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle() }}
      disabled={busy}
      aria-label={saved ? 'Remove from saved' : 'Save article'}
      aria-pressed={saved}
      className="p-1.5 rounded-full text-on-surface-muted hover:text-primary hover:bg-white/5 disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-[20px]" style={saved ? { fontVariationSettings: "'FILL' 1" } : undefined}>bookmark</span>
    </button>
  )
}

function Thumb({ src, className }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return <div className={`${className} bg-surface-container-high flex items-center justify-center`}><span className="material-symbols-outlined text-on-surface-muted">newspaper</span></div>
  }
  return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className={`${className} object-cover`} />
}

function ArticleCard({ article, featured, saved, busy, onToggleSave }) {
  const open = () => article.source_url && window.open(article.source_url, '_blank', 'noopener,noreferrer')
  const meta = (
    <div className="flex gap-2 items-center mb-1 min-w-0">
      {article.related_symbols?.[0] && <span className="font-mono text-xs text-on-surface bg-white/10 px-2 py-1 rounded">{article.related_symbols[0]}</span>}
      <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-muted truncate">{article.source} • {timeAgo(article.published_at)}</span>
    </div>
  )
  if (featured) {
    return (
      <Card hover className="cursor-pointer group" onClick={open}>
        <Thumb src={article.image_url} className="h-48 w-full opacity-90 group-hover:opacity-100" />
        <div className="p-4">
          <div className="flex justify-between items-start gap-2">{meta}<SaveButton saved={saved} busy={busy} onToggle={onToggleSave} /></div>
          <h2 className="font-semibold text-on-surface mb-2 group-hover:text-primary transition-colors">{article.title}</h2>
          {article.summary && <p className="text-sm text-on-surface-muted line-clamp-2">{article.summary}</p>}
        </div>
      </Card>
    )
  }
  return (
    <Card hover className="p-4 flex gap-4 cursor-pointer group" onClick={open}>
      <div className="flex-1 min-w-0">
        {meta}
        <h3 className="font-semibold text-on-surface group-hover:text-primary transition-colors line-clamp-2">{article.title}</h3>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <Thumb src={article.image_url} className="w-24 h-24 rounded-lg border border-white/[0.06]" />
        <SaveButton saved={saved} busy={busy} onToggle={onToggleSave} />
      </div>
    </Card>
  )
}

export default function MarketNews() {
  const [view, setView] = useState('feed')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [feed, setFeed] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState([])            // your bookmarks, newest first
  const [savedError, setSavedError] = useState(null)
  const [busy, setBusy] = useState(() => new Set())  // article ids with a save in flight
  const [actionError, setActionError] = useState(null)

  const loadFeed = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await newsService.fetchNewsFeed({ category: category === 'all' ? null : category, limit: PAGE })
      setFeed({ items: data.items, total: data.total })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [category])

  const loadSaved = useCallback(async () => {
    setSavedError(null)
    try {
      setSaved(await newsService.fetchBookmarks())
    } catch (err) {
      setSavedError(err.message)
    }
  }, [])

  useEffect(() => { loadFeed() }, [loadFeed])
  useEffect(() => { loadSaved() }, [loadSaved])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const data = await newsService.fetchNewsFeed({ category: category === 'all' ? null : category, limit: PAGE, offset: feed.items.length })
      setFeed(f => {
        const seen = new Set(f.items.map(a => a.id))
        return { items: [...f.items, ...data.items.filter(a => !seen.has(a.id))], total: data.total }
      })
    } catch (err) {
      setActionError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const savedIds = new Set(saved.map(b => b.article.id))

  const toggleSave = async article => {
    if (busy.has(article.id)) return
    setActionError(null)
    setBusy(b => new Set(b).add(article.id))
    const wasSaved = savedIds.has(article.id)
    try {
      if (wasSaved) {
        await newsService.unbookmarkArticle(article.id)
        setSaved(list => list.filter(b => b.article.id !== article.id))
      } else {
        const bm = await newsService.bookmarkArticle(article.id)
        setSaved(list => [{ bookmark_id: bm.id, bookmarked_at: bm.created_at, article }, ...list.filter(b => b.article.id !== article.id)])
      }
    } catch (err) {
      // 404 on remove means it was already gone elsewhere: just resync.
      if (wasSaved && err.status === 404) setSaved(list => list.filter(b => b.article.id !== article.id))
      else setActionError(err.message)
    } finally {
      setBusy(b => { const n = new Set(b); n.delete(article.id); return n })
    }
  }

  const term = search.trim().toLowerCase()
  const matches = a => !term || a.title.toLowerCase().includes(term) || (a.summary || '').toLowerCase().includes(term)
    || (a.related_symbols || []).some(s => s.toLowerCase().includes(term))
  const articles = (view === 'feed' ? feed.items : saved.map(b => b.article)).filter(matches)

  const card = (article, featured = false) => (
    <ArticleCard key={article.id} article={article} featured={featured} saved={savedIds.has(article.id)}
      busy={busy.has(article.id)} onToggleSave={() => toggleSave(article)} />
  )

  const retry = view === 'feed' ? loadFeed : loadSaved
  const viewError = view === 'feed' ? error : savedError

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="mb-4 max-w-xs">
        <TabBar tabs={[{ id: 'feed', label: 'News' }, { id: 'saved', label: `Saved${saved.length ? ` (${saved.length})` : ''}` }]} activeTab={view} onChange={setView} />
      </div>

      <div className="mb-4">
        <Input placeholder={view === 'feed' ? 'Filter loaded headlines by word or symbol' : 'Filter saved articles'} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {view === 'feed' && (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-6 pb-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors border ${
                category === cat.id
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-surface-card text-on-surface-muted border-white/[0.06] hover:border-white/20'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {actionError && (
        <div role="alert" className="mb-4 text-sm text-bearish bg-bearish/10 border border-bearish/20 rounded-lg px-3 py-2 flex justify-between gap-2">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} aria-label="Dismiss" className="material-symbols-outlined text-[18px]">close</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 flex flex-col gap-4">
          {view === 'feed' && loading ? (
            <div className="text-center py-12 text-on-surface-muted">Loading market news…</div>
          ) : viewError ? (
            <div className="text-center py-12">
              <p className="text-sm text-on-surface-muted mb-3">{viewError}</p>
              <button onClick={retry} className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-semibold">Try again</button>
            </div>
          ) : articles.length === 0 ? (
            <p className="text-center py-12 text-sm text-on-surface-muted">
              {term ? 'No articles match your filter.' : view === 'feed' ? 'No news in this category yet.' : 'Articles you save will appear here.'}
            </p>
          ) : (
            <>
              {view === 'feed' ? [card(articles[0], true), ...articles.slice(1).map(a => card(a))] : articles.map(a => card(a))}
              {view === 'feed' && !term && (feed.items.length < feed.total ? (
                <button onClick={loadMore} disabled={loadingMore} className="self-center px-4 py-2 rounded-full border border-white/10 text-sm font-semibold text-on-surface hover:bg-white/5 disabled:opacity-50">
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              ) : (
                <p className="text-center text-xs text-on-surface-muted py-2">You're all caught up.</p>
              ))}
            </>
          )}
        </div>

        <aside className="hidden md:block md:col-span-4">
          <TrendingTickers />
        </aside>
      </div>
    </div>
  )
}
