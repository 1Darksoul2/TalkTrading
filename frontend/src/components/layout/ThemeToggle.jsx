import { useTheme } from '../../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full text-on-surface-muted hover:text-on-surface hover:bg-white/5 transition-all active:scale-90"
      aria-label="Toggle theme"
    >
      <span
        className="material-symbols-outlined text-[20px] transition-transform duration-300"
        style={{
          transform: theme === 'dark' ? 'rotate(0deg)' : 'rotate(180deg)',
        }}
      >
        {theme === 'dark' ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  )
}
