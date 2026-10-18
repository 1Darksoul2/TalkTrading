export default function Button({ variant = 'primary', size = 'md', children, className = '', icon, ...rest }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-95 cursor-pointer'
  
  const variants = {
    primary: 'bg-gradient-to-r from-primary to-primary-container text-on-primary hover:opacity-90',
    secondary: 'border border-primary text-primary hover:bg-primary/10',
    ghost: 'text-on-surface-muted hover:text-on-surface hover:bg-white/5',
    icon: 'p-2 rounded-full text-on-surface-muted hover:text-on-surface hover:bg-white/5',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-5 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3 text-base rounded-xl',
  }

  const variantClass = variants[variant] || variants.primary
  const sizeClass = variant === 'icon' ? '' : (sizes[size] || sizes.md)

  return (
    <button className={`${base} ${variantClass} ${sizeClass} ${className}`} {...rest}>
      {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
      {children}
    </button>
  )
}
