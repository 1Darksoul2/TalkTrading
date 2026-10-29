export default function TabBar({ tabs, activeTab, onChange, variant = 'pill' }) {
  if (variant === 'underline') {
    return (
      <div className="flex border-b border-outline-variant/30">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 py-3 text-center text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-muted hover:text-on-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex bg-surface-card rounded-full p-1 overflow-x-auto hide-scrollbar">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 shrink-0 whitespace-nowrap px-3 py-2 text-center rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
            activeTab === tab.id
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-muted hover:text-on-surface'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
