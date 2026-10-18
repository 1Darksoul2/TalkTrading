import { useEffect, useState } from 'react'
import { getBatchQuotes } from '../services/chartService'

const REFRESH_MS = 30000

// Live quotes from the Chart Service, refreshed every 30s. Empty until the first response
// (and if the service is unreachable) so callers never show made-up numbers.
export function useLiveQuotes(symbols) {
  const [quotes, setQuotes] = useState([])
  const key = symbols.join(',')

  useEffect(() => {
    let cancelled = false
    const load = () =>
      getBatchQuotes(key.split(','))
        .then(data => { if (!cancelled) setQuotes(data.quotes) })
        .catch(() => {})
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [key])

  return quotes
}
