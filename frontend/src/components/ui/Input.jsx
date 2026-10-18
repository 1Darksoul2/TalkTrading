export default function Input({ placeholder, icon = 'search', value, onChange, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-muted text-[20px]">
        {icon}
      </span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full bg-surface-card border border-white/[0.06] rounded-xl py-2.5 pl-11 pr-4 text-on-surface text-sm placeholder:text-on-surface-muted/50 focus:border-primary/30 focus:ring-1 focus:ring-primary/20 focus:outline-none transition-colors"
      />
    </div>
  )
}
