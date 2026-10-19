import { useEffect, useRef, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { useWatchlist } from '../context/WatchlistContext'
import { useTheme } from '../context/ThemeContext'
import Button from '../components/ui/Button'
import { getQuote, getSymbols } from '../services/chartService'

// TradingView symbol format for each ticker — used for the embedded chart widget
const symbolMap = {
  AAPL: 'NASDAQ:AAPL', TSLA: 'NASDAQ:TSLA', NVDA: 'NASDAQ:NVDA', AMZN: 'NASDAQ:AMZN',
  META: 'NASDAQ:META', GOOGL: 'NASDAQ:GOOGL', MSFT: 'NASDAQ:MSFT', AMD: 'NASDAQ:AMD',
  SPY: 'AMEX:SPY', BTC: 'BINANCE:BTCUSDT', ETH: 'BINANCE:ETHUSDT', SOL: 'BINANCE:SOLUSDT',
  XRP: 'BINANCE:XRPUSDT', 'EUR/USD': 'FX:EURUSD', 'GBP/USD': 'FX:GBPUSD',
  'USD/JPY': 'FX:USDJPY', 'USD/INR': 'FX:USDINR', XAUUSD: 'TVC:GOLD',
  XAGUSD: 'TVC:SILVER', CL: 'NYMEX:CL1!',
}

// ── Header Skeleton ────────────────────────────────────────────────────────────
function QuoteSkeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-1">
      <div className="h-6 w-32 bg-white/10 rounded" />
      <div className="h-4 w-24 bg-white/[0.06] rounded" />
    </div>
  )
}

export default function StockChart() {
  const params = useParams()
  const location = useLocation()
  // Extract symbol from wildcard route: /market/* captures everything after /market/
  const symbol = params['*'] || location.pathname.replace(/^\/market\//, '')
  const { theme } = useTheme()
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist()
  const containerRef = useRef(null)

  // Live quote state
  const [quote, setQuote] = useState(null)
  const [symbolMeta, setSymbolMeta] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [quoteError, setQuoteError] = useState('')

  const tvSymbol = symbolMap[symbol] || symbol
  const inWatchlist = isInWatchlist(symbol)

  // ── Fetch symbol metadata + live quote ─────────────────────────────────────
  useEffect(() => {
    if (!symbol) return
    setQuoteLoading(true)
    setQuote(null)
    setSymbolMeta(null)

    // Fetch symbol metadata and quote in parallel
    Promise.allSettled([
      getSymbols(),
      getQuote(symbol),
    ]).then(([symbolsResult, quoteResult]) => {
      if (symbolsResult.status === 'fulfilled') {
        const found = symbolsResult.value?.items?.find(s => s.symbol === symbol)
        setSymbolMeta(found || null)
      }
      if (quoteResult.status === 'fulfilled') {
        setQuote(quoteResult.value)
        setQuoteError('')
      } else {
        setQuoteError(`Live price unavailable: ${quoteResult.reason?.message}`)
      }
    }).finally(() => setQuoteLoading(false))
  }, [symbol])

  // ── Auto-refresh quote every 60s ───────────────────────────────────────────
  useEffect(() => {
    if (!symbol) return
    const interval = setInterval(() => {
      getQuote(symbol)
        .then(q => { setQuote(q); setQuoteError('') })
        .catch(err => setQuoteError(`Live price unavailable: ${err.message}`))
    }, 60_000)
    return () => clearInterval(interval)
  }, [symbol])

  // ── Inject TradingView Advanced Chart Widget ───────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Insert on the next tick and cancel on cleanup, so a run that is immediately replaced
    // (symbol/theme change, React's double effect in dev) never loads a script whose
    // container is already gone - the TradingView embed throws in that case.
    const wrapper = document.createElement('div')
    wrapper.className = 'tradingview-widget-container'   // the embed script looks for this on its parent
    wrapper.style.height = '100%'
    wrapper.style.width = '100%'

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    widgetDiv.style.height = '100%'
    widgetDiv.style.width = '100%'
    widgetDiv.style.minHeight = '600px'

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

    wrapper.appendChild(widgetDiv)
    wrapper.appendChild(script)
    const timer = setTimeout(() => container.appendChild(wrapper), 0)
    return () => {
      clearTimeout(timer)
      wrapper.remove()
    }
  }, [tvSymbol, theme])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const displayName = symbolMeta?.name || symbol

  const formatPrice = price => {
    if (!price && price !== 0) return '—'
    const cat = symbolMeta?.category
    if (cat === 'crypto' && price > 1000)
      return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    if (cat === 'forex') return price.toFixed(4)
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const change = quote?.change
  const changePct = quote?.change_percent
  const isPositive = (changePct ?? 0) >= 0

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <Link to="/market" className="text-on-surface-muted hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono font-bold text-lg text-on-surface">{symbol}</h1>
              <span className="text-sm text-on-surface-muted">{displayName}</span>
              {symbolMeta?.exchange && (
                <span className="text-[10px] font-mono text-on-surface-muted bg-white/[0.06] px-1.5 py-0.5 rounded">
                  {symbolMeta.exchange}
                </span>
              )}
            </div>

            {/* Live Quote */}
            {quoteLoading ? (
              <QuoteSkeleton />
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono font-semibold text-on-surface">
                  {formatPrice(quote?.price)}
                </span>
                {change !== null && change !== undefined && (
                  <span className={`font-mono text-sm ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
                    {change >= 0 ? '+' : ''}
                    {change?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {' '}
                    ({changePct >= 0 ? '+' : ''}{changePct?.toFixed(2)}%)
                  </span>
                )}
                {quoteError && <span className="text-xs text-warning">{quoteError}</span>}
                {quote?.price != null && !quoteError && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-bullish/80 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-bullish animate-pulse inline-block" />
                    Live
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => inWatchlist ? removeFromWatchlist(symbol) : addToWatchlist(symbol)}
          className={`p-2 rounded-full transition-colors ${
            inWatchlist ? 'text-primary' : 'text-on-surface-muted hover:text-primary'
          }`}
        >
          <span
            className="material-symbols-outlined"
            style={inWatchlist ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            star
          </span>
        </button>
      </div>

      {/* TradingView Advanced Chart Widget */}
      <div
        ref={containerRef}
        className="flex-1 w-full min-h-[550px]"
        style={{ height: 'calc(100vh - 150px)', minHeight: '550px' }}
      />

      {/* Bottom Actions */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-white/[0.06]">
        <div className="flex gap-6">
          {[
            { label: 'Open',  value: quote?.open  ? formatPrice(quote.open)  : '—' },
            { label: 'High',  value: quote?.high  ? formatPrice(quote.high)  : '—' },
            { label: 'Low',   value: quote?.low   ? formatPrice(quote.low)   : '—' },
            { label: 'Prev Close', value: quote?.prev_close ? formatPrice(quote.prev_close) : '—' },
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
