import { Link } from 'react-router-dom'
import Card from './ui/Card'
import { useLiveQuotes } from '../hooks/useLiveQuotes'

const SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'AMZN', 'META', 'GOOGL', 'MSFT', 'AMD']

export default function TrendingTickers() {
  const { quotes, unavailable } = useLiveQuotes(SYMBOLS)

  return (
    <Card className="p-4 sticky top-24 border border-white/10">
      <h3 className="font-semibold text-on-surface border-b border-outline-variant/30 pb-2 mb-3 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-primary text-lg">trending_up</span>
        Trending Tickers
      </h3>
      <div className="flex flex-col gap-2">
        {unavailable && <p className="text-xs text-on-surface-muted px-2.5">Live prices are unavailable right now.</p>}
        {quotes.map(q => (
          <Link key={q.symbol} to={`/market/${q.symbol}`} className="flex justify-between items-center hover:bg-white/5 rounded-lg px-2.5 py-1.5 transition-colors">
            <span className="font-mono text-sm font-semibold text-on-surface">${q.symbol}</span>
            <span className={`font-mono text-sm ${q.change_percent >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {q.change_percent >= 0 ? '+' : ''}{q.change_percent.toFixed(2)}%
            </span>
          </Link>
        ))}
      </div>
    </Card>
  )
}
