import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { useWatchlist } from '../context/WatchlistContext'
import { getSymbols, getBatchQuotes, getSparkline } from '../services/chartService'

const categories = [
  { id: 'all',       label: 'All' },
  { id: 'stock',     label: 'Stocks' },
  { id: 'crypto',    label: 'Crypto' },
  { id: 'forex',     label: 'Forex' },
  { id: 'commodity', label: 'Commodities' },
]

// ── Mini Sparkline SVG ────────────────────────────────────────────────────────
function MiniSparkline({ data, positive }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${40 - ((v - min) / range) * 36}`)
    .join(' ')

  return (
    <svg viewBox="0 0 100 40" className="w-20 h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-grad-${positive}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={positive ? '#22C55E' : '#EF4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={positive ? '#22C55E' : '#EF4444'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#22C55E' : '#EF4444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Skeleton Loader ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-surface-card rounded-xl p-4 flex items-center justify-between gap-3 animate-pulse">
      <div className="flex-1 space-y-2">
        <div className="h-4 w-16 bg-white/10 rounded" />
        <div className="h-3 w-28 bg-white/[0.06] rounded" />
      </div>
      <div className="w-20 h-10 bg-white/[0.06] rounded" />
      <div className="text-right space-y-1">
        <div className="h-4 w-16 bg-white/10 rounded" />
        <div className="h-3 w-10 bg-white/[0.06] rounded ml-auto" />
      </div>
    </div>
  )
}

function SkeletonWatchlistCard() {
  return (
    <div className="bg-surface-card rounded-xl p-3 min-w-[160px] flex flex-col gap-2 animate-pulse shrink-0">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="h-4 w-12 bg-white/10 rounded" />
          <div className="h-3 w-20 bg-white/[0.06] rounded" />
        </div>
        <div className="w-4 h-4 bg-white/[0.06] rounded" />
      </div>
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="h-4 w-16 bg-white/10 rounded" />
          <div className="h-3 w-10 bg-white/[0.06] rounded" />
        </div>
        <div className="w-16 h-8 bg-white/[0.06] rounded" />
      </div>
    </div>
  )
}

// ── Live Badge ─────────────────────────────────────────────────────────────────
function LiveBadge() {
  return (
    <span className="flex items-center gap-1 text-[10px] font-mono text-bullish/80 uppercase tracking-widest">
      <span className="w-1.5 h-1.5 rounded-full bg-bullish animate-pulse inline-block" />
      Live
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MarketCharts() {
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist()

  // Live data state
  const [symbols, setSymbols] = useState([])
  const [quotes, setQuotes] = useState({})        // { SYMBOL: { price, change, change_percent } }
  const [sparklines, setSparklines] = useState({}) // { SYMBOL: [prices] }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // ── Fetch symbol list ──────────────────────────────────────────────────────
  useEffect(() => {
    getSymbols()
      .then(data => setSymbols(data.items || []))
      .catch(err => {
        console.warn('chart-service unavailable, check if it is running on port 8002:', err.message)
        setError('Chart service offline. Start chart-service on port 8002.')
      })
  }, [])

  // ── Fetch batch quotes ─────────────────────────────────────────────────────
  const fetchQuotes = useCallback(async () => {
    if (symbols.length === 0) return
    try {
      const syms = symbols.map(s => s.symbol)
      const data = await getBatchQuotes(syms)
      const map = {}
      for (const q of data.quotes || []) {
        map[q.symbol] = q
      }
      setQuotes(map)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      console.warn('Failed to fetch batch quotes:', err.message)
    } finally {
      setLoading(false)
    }
  }, [symbols])

  useEffect(() => {
    fetchQuotes()
    // Auto-refresh quotes every 60s
    const interval = setInterval(fetchQuotes, 60_000)
    return () => clearInterval(interval)
  }, [fetchQuotes])

  // ── Fetch sparklines lazily ────────────────────────────────────────────────
  useEffect(() => {
    if (symbols.length === 0) return
    symbols.forEach(sym => {
      getSparkline(sym.symbol)
        .then(data => {
          setSparklines(prev => ({ ...prev, [sym.symbol]: data.prices || [] }))
        })
        .catch(() => {}) // sparklines are best-effort
    })
  }, [symbols])

  // ── Filter logic ───────────────────────────────────────────────────────────
  const filtered = symbols.filter(t => {
    const matchCat = activeCat === 'all' || t.category === activeCat
    const matchSearch =
      !search ||
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const watchlistSymbols = symbols.filter(t => watchlist.includes(t.symbol))

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getPrice = sym => quotes[sym]?.price ?? null
  const getChange = sym => quotes[sym]?.change ?? null
  const getChangePct = sym => quotes[sym]?.change_percent ?? null
  const getSparklineData = sym => sparklines[sym] ?? []
  const isPositive = sym => (getChangePct(sym) ?? 0) >= 0

  const formatPrice = (price, symbol) => {
    if (price === null) return '—'
    const sym = symbols.find(s => s.symbol === symbol)
    const isCrypto = sym?.category === 'crypto'
    const isForex = sym?.category === 'forex'
    if (isCrypto && price > 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    if (isForex) return price.toFixed(4)
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatChangePct = pct => {
    if (pct === null) return '—'
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error && symbols.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center space-y-3">
        <span className="material-symbols-outlined text-4xl text-bearish">signal_disconnected</span>
        <p className="text-on-surface-muted text-sm">{error}</p>
        <p className="text-on-surface-muted/50 text-xs font-mono">
          Run: python -m uvicorn app.main:app --port 8002 --app-dir chart-service
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search stocks, crypto, forex..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {lastUpdated && (
          <div className="shrink-0 flex flex-col items-end">
            <LiveBadge />
            <span className="text-[9px] text-on-surface-muted/50 font-mono mt-0.5">
              {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCat(cat.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors border ${
              activeCat === cat.id
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-card text-on-surface-muted border-white/[0.06] hover:border-white/20'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Watchlist */}
      {(loading ? [null, null, null] : watchlistSymbols).length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              star
            </span>
            Your Watchlist
            {!loading && (
              <span className="text-on-surface-muted/50">({watchlistSymbols.length})</span>
            )}
          </h2>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {loading
              ? [1, 2, 3].map(i => <SkeletonWatchlistCard key={i} />)
              : watchlistSymbols.map(t => {
                  const pct = getChangePct(t.symbol)
                  const positive = isPositive(t.symbol)
                  return (
                    <Link key={t.symbol} to={`/market/${t.symbol}`} className="shrink-0">
                      <Card hover className="p-3 min-w-[160px] flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-mono font-bold text-on-surface text-sm">{t.symbol}</div>
                            <div className="text-[10px] text-on-surface-muted">{t.name}</div>
                          </div>
                          <button
                            onClick={e => { e.preventDefault(); removeFromWatchlist(t.symbol) }}
                            className="text-primary hover:text-primary/70 transition-colors"
                          >
                            <span
                              className="material-symbols-outlined text-[18px]"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              star
                            </span>
                          </button>
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="font-mono text-on-surface font-semibold text-sm">
                              {formatPrice(getPrice(t.symbol), t.symbol)}
                            </div>
                            <span className={`font-mono text-xs ${positive ? 'text-bullish' : 'text-bearish'}`}>
                              {formatChangePct(pct)}
                            </span>
                          </div>
                          <MiniSparkline data={getSparklineData(t.symbol)} positive={positive} />
                        </div>
                      </Card>
                    </Link>
                  )
                })}
          </div>
        </section>
      )}

      {/* Market List */}
      <section>
        <h2 className="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
          Markets
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading
            ? [1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)
            : filtered.map(t => {
                const pct = getChangePct(t.symbol)
                const positive = isPositive(t.symbol)
                return (
                  <Link key={t.symbol} to={`/market/${t.symbol}`}>
                    <Card hover className="p-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-on-surface">{t.symbol}</span>
                          <button
                            onClick={e => {
                              e.preventDefault()
                              isInWatchlist(t.symbol)
                                ? removeFromWatchlist(t.symbol)
                                : addToWatchlist(t.symbol)
                            }}
                            className={`transition-colors ${
                              isInWatchlist(t.symbol)
                                ? 'text-primary'
                                : 'text-on-surface-muted/30 hover:text-on-surface-muted'
                            }`}
                          >
                            <span
                              className="material-symbols-outlined text-[16px]"
                              style={isInWatchlist(t.symbol) ? { fontVariationSettings: "'FILL' 1" } : {}}
                            >
                              star
                            </span>
                          </button>
                        </div>
                        <div className="text-xs text-on-surface-muted truncate">{t.name}</div>
                      </div>
                      <MiniSparkline data={getSparklineData(t.symbol)} positive={positive} />
                      <div className="text-right">
                        <div className="font-mono text-sm text-on-surface">
                          {formatPrice(getPrice(t.symbol), t.symbol)}
                        </div>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            positive ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish'
                          }`}
                        >
                          {formatChangePct(pct)}
                        </span>
                      </div>
                    </Card>
                  </Link>
                )
              })}
        </div>
      </section>
    </div>
  )
}
