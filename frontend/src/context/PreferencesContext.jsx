import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// Device-level interface preferences. They are stored on this device on purpose (what suits one screen or one
// person's eyes does not necessarily suit another device), and every one of them changes how the app behaves.
const KEY = 'tt-prefs'
const DEFAULTS = {
  autoplayVideos: true,   // story videos start playing by themselves
  reduceMotion: false,    // no animated transitions anywhere
  highContrast: false,    // stronger text and border contrast
}

const PreferencesContext = createContext(null)

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(load)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* storage unavailable: keep in memory only */ }
    const root = document.documentElement
    root.classList.toggle('reduce-motion', prefs.reduceMotion)
    root.classList.toggle('high-contrast', prefs.highContrast)
  }, [prefs])

  const setPref = useCallback((name, value) => setPrefs(prev => ({ ...prev, [name]: value })), [])
  const value = useMemo(() => ({ ...prefs, setPref }), [prefs, setPref])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider')
  return ctx
}
