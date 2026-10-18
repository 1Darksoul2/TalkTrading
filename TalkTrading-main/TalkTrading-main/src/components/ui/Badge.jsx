const variantStyles = {
  bullish: 'bg-bullish/20 text-bullish',
  bearish: 'bg-bearish/20 text-bearish',
  pro: 'bg-surface-variant text-on-surface-variant',
  count: 'bg-primary text-on-primary rounded-full min-w-5 h-5 flex items-center justify-center',
  tag: 'bg-white/10 text-on-surface',
}

export default function Badge({ variant = 'tag', children, className = '' }) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold font-mono uppercase tracking-wider'

  return (
    <span className={`${base} ${variantStyles[variant] || variantStyles.tag} ${className}`}>
      {variant === 'pro' && <span className="material-symbols-outlined text-[14px]">workspace_premium</span>}
      {children}
    </span>
  )
}
