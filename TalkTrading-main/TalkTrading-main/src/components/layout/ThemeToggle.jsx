import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../../context/ThemeContext'

const themes = [
  { id: 'light', label: 'Light', icon: 'light_mode' },
  { id: 'dark', label: 'Midnight', icon: 'dark_mode' },
  { id: 'black', label: 'Dark', icon: 'brightness_2' },
]

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const current = themes.find(t => t.id === theme) || themes[1]

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="p-2 rounded-full text-on-surface-muted hover:text-on-surface hover:bg-white/5 transition-all active:scale-90"
        aria-label="Change theme"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[20px]">
          {current.icon}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-40 rounded-xl bg-surface-card border border-outline-variant shadow-lg overflow-hidden z-50">
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false) }}
              className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                theme === t.id
                  ? 'text-primary bg-primary/10'
                  : 'text-on-surface-muted hover:text-on-surface hover:bg-white/5'
              }`}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={theme === t.id ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {t.icon}
              </span>
              {t.label}
              {theme === t.id && (
                <span className="material-symbols-outlined text-[16px] ml-auto text-primary">check</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
