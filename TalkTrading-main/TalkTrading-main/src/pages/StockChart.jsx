import { useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useWatchlist } from '../context/WatchlistContext'
import { useTheme } from '../context/ThemeContext'
import Button from '../components/ui/Button'
import mockTickers from '../data/mockTickers'

const symbolMap = {
  AAPL: 'NASDAQ:AAPL', TSLA: 'NASDAQ:TSLA', NVDA: 'NASDAQ:NVDA', AMZN: 'NASDAQ:AMZN',
  META: 'NASDAQ:META', GOOGL: 'NASDAQ:GOOGL', MSFT: 'NASDAQ:MSFT', AMD: 'NASDAQ:AMD',
  SPY: 'AMEX:SPY', BTC: 'BINANCE:BTCUSDT', ETH: 'BINANCE:ETHUSDT', SOL: 'BINANCE:SOLUSDT',
  XRP: 'BINANCE:XRPUSDT', 'EUR/USD': 'FX:EURUSD', 'GBP/USD': 'FX:GBPUSD',
  'USD/JPY': 'FX:USDJPY', 'USD/INR': 'FX:USDINR', XAUUSD: 'TVC:GOLD',
  XAGUSD: 'TVC:SILVER', CL: 'NYMEX:CL1!',
}

export default function StockChart() {
  const { symbol } = useParams()
  const { theme } = useTheme()
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist()
  const containerRef = useRef(null)
  const ticker = mockTickers.find(t => t.symbol === symbol)
  const tvSymbol = symbolMap[symbol] || symbol
  const inWatchlist = isInWatchlist(symbol)

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ''

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    widgetDiv.style.height = '100%'
    widgetDiv.style.width = '100%'

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: theme === 'light' ? 'light' : 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: theme === 'black' ? '#000000' : theme === 'dark' ? '#0B1120' : '#F5F5F7',
      gridColor: theme === 'black' ? 'rgba(255,255,255,0.03)' : theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
      allow_symbol_change: true,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    })

    containerRef.current.appendChild(widgetDiv)
    containerRef.current.appendChild(script)
  }, [tvSymbol, theme])

  if (!ticker) {
    return (
      <div className="p-8 text-center">
        <p className="text-on-surface-muted mb-4">Ticker "{symbol}" not found</p>
        <Link to="/market" className="text-primary hover:underline">← Back to Market</Link>
      </div>
    )
  }

  return (
    <div className="max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <Link to="/market" className="text-on-surface-muted hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono font-bold text-lg text-on-surface">{ticker.symbol}</h1>
              <span className="text-sm text-on-surface-muted">{ticker.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-on-surface">
                ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`font-mono text-sm ${ticker.changePercent >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                {ticker.change >= 0 ? '+' : ''}{ticker.change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                ({ticker.changePercent >= 0 ? '+' : ''}{ticker.changePercent}%)
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => inWatchlist ? removeFromWatchlist(symbol) : addToWatchlist(symbol)}
          className={`p-2 rounded-full transition-colors ${inWatchlist ? 'text-primary' : 'text-on-surface-muted hover:text-primary'}`}
        >
          <span className="material-symbols-outlined" style={inWatchlist ? { fontVariationSettings: "'FILL' 1" } : {}}>star</span>
        </button>
      </div>

      {/* TradingView Chart */}
      <div
        ref={containerRef}
        className="tradingview-widget-container w-full"
        style={{ height: 'calc(100dvh - 14rem)' }}
      />

      {/* Bottom Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
        <div className="flex gap-6">
          {[
            { label: 'Open', value: (ticker.price - ticker.change * 0.3).toFixed(2) },
            { label: 'High', value: (ticker.price + Math.abs(ticker.change) * 0.8).toFixed(2) },
            { label: 'Low', value: (ticker.price - Math.abs(ticker.change) * 1.2).toFixed(2) },
          ].map(s => (
            <div key={s.label} className="hidden sm:block">
              <div className="text-[10px] text-on-surface-muted uppercase tracking-wider">{s.label}</div>
              <div className="font-mono text-sm text-on-surface">{s.value}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon="share">Share</Button>
          <Button
            variant={inWatchlist ? 'ghost' : 'primary'}
            size="sm"
            icon="star"
            onClick={() => inWatchlist ? removeFromWatchlist(symbol) : addToWatchlist(symbol)}
          >
            {inWatchlist ? 'Remove' : 'Watchlist'}
          </Button>
        </div>
      </div>
    </div>
  )
}
