import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tt-theme') || 'dark'
    }
    return 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('theme-transitioning')
    root.classList.remove('dark', 'light', 'black')
    root.classList.add(theme)
    localStorage.setItem('tt-theme', theme)
    const timer = setTimeout(() => root.classList.remove('theme-transitioning'), 300)
    return () => clearTimeout(timer)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}
