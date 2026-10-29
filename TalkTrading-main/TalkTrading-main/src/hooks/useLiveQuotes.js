import { useEffect, useState } from 'react'
import { getBatchQuotes } from '../services/chartService'

const REFRESH_MS = 30000

// Live quotes from the Chart Service, refreshed every 30s. Only quotes with a real price and
// change are returned, so callers never show made-up numbers. `unavailable` is true when the
// service or its market-data provider could not supply any of them.
export function useLiveQuotes(symbols) {
  const [state, setState] = useState({ quotes: [], unavailable: false })
  const key = [...new Set(symbols)].filter(Boolean).join(',')

  useEffect(() => {
    if (!key) {
      setState({ quotes: [], unavailable: false })
      return
    }
    let cancelled = false
    const load = () =>
      getBatchQuotes(key.split(','))
        .then(data => {
          if (cancelled) return
          const quotes = data.quotes.filter(q => q.price != null && q.change_percent != null)
          setState({ quotes, unavailable: quotes.length === 0 })
        })
        .catch(err => {
          if (cancelled) return
          console.error('Live quotes unavailable:', err.message)
          setState(prev => ({ ...prev, unavailable: true }))
        })
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [key])

  return state
}
