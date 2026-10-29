import { cloneElement, isValidElement, useId } from 'react'
import Toggle from './Toggle'

export default function SettingsRow({ icon, label, description, trailing, onClick, danger = false }) {
  const interactive = typeof onClick === 'function'
  const labelId = useId()
  // A switch in the row is named by the row's label, so screen readers say what it turns on.
  const control = isValidElement(trailing) && trailing.type === Toggle ? cloneElement(trailing, { labelledBy: labelId }) : trailing
  return (
    <div
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={`flex items-center gap-3.5 px-4 py-3.5 ${
        interactive ? 'cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors' : ''
      }`}
    >
      {icon && (
        <span
          className={`material-symbols-outlined text-[22px] flex-shrink-0 ${danger ? 'text-error' : 'text-on-surface-muted'}`}
        >
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p id={labelId} className={`text-sm font-medium truncate ${danger ? 'text-error' : 'text-on-surface'}`}>{label}</p>
        {description && (
          <p className="text-xs text-on-surface-muted mt-0.5 line-clamp-2">{description}</p>
        )}
      </div>
      {control}
    </div>
  )
}
