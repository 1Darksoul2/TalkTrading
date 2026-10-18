export default function TickerChip({ symbol, price, changePercent, icon, onClick }) {
  const isPositive = parseFloat(changePercent) >= 0
  
  return (
    <div
      className="flex items-center gap-2 pr-4 border-r border-outline-variant/30 last:border-r-0 last:pr-0 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={onClick}
    >
      {icon && (
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isPositive ? 'bg-primary/20' : 'bg-surface-container-high'}`}>
          <span className={`material-symbols-outlined text-[14px] ${isPositive ? 'text-primary' : 'text-on-surface-muted'}`}>{icon}</span>
        </div>
      )}
      <span className="font-bold text-on-surface text-sm">{symbol}</span>
      <span className="text-on-surface-muted text-sm font-mono">{typeof price === 'number' ? price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : price}</span>
      <span className={`text-sm font-mono ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
        {isPositive ? '+' : ''}{changePercent}%
      </span>
    </div>
  )
}
