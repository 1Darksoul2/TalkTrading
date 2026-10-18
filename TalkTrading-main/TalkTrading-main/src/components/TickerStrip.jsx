import { Link } from 'react-router-dom'
import { useLiveQuotes } from '../hooks/useLiveQuotes'

const SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'AMZN', 'META']

// Live prices from the Chart Service; renders nothing until quotes arrive.
export default function TickerStrip() {
  const { quotes } = useLiveQuotes(SYMBOLS)

  if (quotes.length === 0) return null
  return (
    <section className="sticky top-16 z-30 py-2 mx-4 md:mx-0">
      <div className="overflow-x-auto hide-scrollbar flex items-center gap-4 px-4 py-2.5 bg-surface-card rounded-full border border-white/[0.06]">
        {quotes.map(q => {
          const up = q.change_percent >= 0
          return (
            <Link key={q.symbol} to={`/market/${q.symbol}`} className="flex items-center gap-2 pr-4 border-r border-outline-variant/30 last:border-r-0 last:pr-0 shrink-0 hover:opacity-80 transition-opacity">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${up ? 'bg-primary/20' : 'bg-surface-container-high'}`}>
                <span className={`material-symbols-outlined text-[14px] ${up ? 'text-primary' : 'text-on-surface-muted'}`}>
                  {up ? 'trending_up' : 'trending_down'}
                </span>
              </div>
              <span className="font-bold text-on-surface text-sm">{q.symbol}</span>
              <span className="text-on-surface-muted text-sm font-mono">{q.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className={`text-sm font-mono ${up ? 'text-bullish' : 'text-bearish'}`}>
                {up ? '+' : ''}{q.change_percent.toFixed(2)}%
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
