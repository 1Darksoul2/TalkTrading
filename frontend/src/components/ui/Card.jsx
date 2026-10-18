export default function Card({ children, className = '', glass = false, glow = false, hover = false, onClick }) {
  const base = 'bg-surface-card rounded-xl overflow-hidden border border-white/[0.06]'
  const glassClass = glass ? 'glass-panel' : ''
  const glowClass = glow ? 'gold-glow' : ''
  const hoverClass = hover ? 'hover:border-primary/50 transition-all cursor-pointer' : ''

  return (
    <div
      className={`${base} ${glassClass} ${glowClass} ${hoverClass} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  )
}
