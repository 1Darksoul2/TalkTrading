import { useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { useWatchlist } from '../context/WatchlistContext'
import mockTickers from '../data/mockTickers'

const categories = [
  { id: 'all', label: 'All' },
  { id: 'stock', label: 'Stocks' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'forex', label: 'Forex' },
  { id: 'commodity', label: 'Commodities' },
]

function MiniSparkline({ data, positive }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${40 - ((v - min) / range) * 36}`).join(' ')

  return (
    <svg viewBox="0 0 100 40" className="w-20 h-10" preserveAspectRatio="none">
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

export default function MarketCharts() {
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist()

  const filtered = mockTickers.filter(t => {
    const matchCat = activeCat === 'all' || t.category === activeCat
    const matchSearch = !search || t.symbol.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const watchlistTickers = mockTickers.filter(t => watchlist.includes(t.symbol))

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      <Input placeholder="Search stocks, crypto, forex..." value={search} onChange={e => setSearch(e.target.value)} />

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
      {watchlistTickers.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            Your Watchlist <span className="text-on-surface-muted/50">({watchlistTickers.length})</span>
          </h2>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {watchlistTickers.map(t => (
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
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    </button>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="font-mono text-on-surface font-semibold">${t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <span className={`font-mono text-xs ${t.changePercent >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                        {t.changePercent >= 0 ? '+' : ''}{t.changePercent}%
                      </span>
                    </div>
                    <MiniSparkline data={t.miniChartData} positive={t.changePercent >= 0} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Market List */}
      <section>
        <h2 className="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Markets</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(t => (
            <Link key={t.symbol} to={`/market/${t.symbol}`}>
              <Card hover className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-on-surface">{t.symbol}</span>
                    <button
                      onClick={e => {
                        e.preventDefault()
                        isInWatchlist(t.symbol) ? removeFromWatchlist(t.symbol) : addToWatchlist(t.symbol)
                      }}
                      className={`transition-colors ${isInWatchlist(t.symbol) ? 'text-primary' : 'text-on-surface-muted/30 hover:text-on-surface-muted'}`}
                    >
                      <span className="material-symbols-outlined text-[16px]" style={isInWatchlist(t.symbol) ? { fontVariationSettings: "'FILL' 1" } : {}}>star</span>
                    </button>
                  </div>
                  <div className="text-xs text-on-surface-muted truncate">{t.name}</div>
                </div>
                <MiniSparkline data={t.miniChartData} positive={t.changePercent >= 0} />
                <div className="text-right">
                  <div className="font-mono text-sm text-on-surface">{t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                    t.changePercent >= 0 ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish'
                  }`}>
                    {t.changePercent >= 0 ? '+' : ''}{t.changePercent}%
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
