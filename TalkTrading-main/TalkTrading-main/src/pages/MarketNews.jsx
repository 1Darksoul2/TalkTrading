import { useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import mockNews from '../data/mockNews'
import mockTickers from '../data/mockTickers'

const categories = ['general', 'global', 'indian', 'forex', 'crypto']
const categoryLabels = { general: 'General', global: 'Global Market', indian: 'Indian Market', forex: 'Forex', crypto: 'Crypto' }

export default function MarketNews() {
  const [activeFilter, setActiveFilter] = useState('general')
  const [search, setSearch] = useState('')

  const filtered = mockNews.filter(n => {
    const matchCat = activeFilter === 'general' || n.category === activeFilter
    const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const featured = filtered.find(n => n.isFeatured)
  const regular = filtered.filter(n => !n.isFeatured)

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Search */}
      <div className="mb-4">
        <Input placeholder="Search news, symbols, or topics" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-6 pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors border ${
              activeFilter === cat
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'bg-surface-card text-on-surface-muted border-white/[0.06] hover:border-white/20'
            }`}
          >
            {categoryLabels[cat]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* News Feed */}
        <div className="md:col-span-8 flex flex-col gap-4">
          {/* Featured */}
          {featured && (
            <Card hover className="cursor-pointer group">
              <div className="h-48 w-full relative">
                <img src={featured.image} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-3 left-3 flex gap-2 items-center">
                  <span className="font-mono text-xs text-on-surface bg-white/10 px-2 py-1 rounded">{featured.ticker}</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-muted">{featured.source} • {featured.timestamp}</span>
                </div>
              </div>
              <div className="p-4">
                <h2 className="font-semibold text-on-surface mb-2 group-hover:text-primary transition-colors">{featured.title}</h2>
                <p className="text-sm text-on-surface-muted line-clamp-2">{featured.summary}</p>
              </div>
            </Card>
          )}

          {/* Regular Cards */}
          {regular.map(article => (
            <Card key={article.id} hover className="p-4 flex gap-4 cursor-pointer group">
              <div className="flex-1">
                <div className="flex gap-2 items-center mb-1">
                  <span className="font-mono text-xs text-on-surface bg-white/10 px-2 py-1 rounded">{article.ticker}</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-muted">{article.source} • {article.timestamp}</span>
                </div>
                <h3 className="font-semibold text-on-surface group-hover:text-primary transition-colors line-clamp-2">{article.title}</h3>
              </div>
              <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-white/[0.06]">
                <img src={article.image} alt="" className="w-full h-full object-cover" />
              </div>
            </Card>
          ))}
        </div>

        {/* Sidebar */}
        <aside className="hidden md:block md:col-span-4">
          <Card className="p-4 sticky top-24">
            <h3 className="font-semibold text-primary mb-3 border-b border-white/10 pb-2">Trending Tickers</h3>
            <ul className="flex flex-col gap-2">
              {mockTickers.slice(0, 6).map(t => (
                <li key={t.symbol} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${t.changePercent >= 0 ? 'bg-bullish' : 'bg-bearish'}`} />
                    <span className="font-mono text-sm text-on-surface">{t.symbol}</span>
                  </div>
                  <span className={`font-mono text-sm ${t.changePercent >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                    {t.changePercent >= 0 ? '+' : ''}{t.changePercent}%
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  )
}
