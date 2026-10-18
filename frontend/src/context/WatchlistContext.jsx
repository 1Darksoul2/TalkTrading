import { createContext, useContext, useState, useEffect } from 'react'

const WatchlistContext = createContext()

const DEFAULT_WATCHLIST = ['AAPL', 'TSLA', 'NVDA', 'BTC', 'ETH']

export function WatchlistProvider({ children }) {
  const [watchlist, setWatchlist] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tt-watchlist')
      return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST
    }
    return DEFAULT_WATCHLIST
  })

  useEffect(() => {
    localStorage.setItem('tt-watchlist', JSON.stringify(watchlist))
  }, [watchlist])

  const addToWatchlist = (symbol) => {
    setWatchlist(prev => prev.includes(symbol) ? prev : [...prev, symbol])
  }

  const removeFromWatchlist = (symbol) => {
    setWatchlist(prev => prev.filter(s => s !== symbol))
  }

  const isInWatchlist = (symbol) => watchlist.includes(symbol)

  return (
    <WatchlistContext.Provider value={{ watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist }}>
      {children}
    </WatchlistContext.Provider>
  )
}

export function useWatchlist() {
  const context = useContext(WatchlistContext)
  if (!context) throw new Error('useWatchlist must be used within a WatchlistProvider')
  return context
}
