import { useNavigate } from 'react-router-dom'

export default function SettingsHeader({ title, onBack }) {
  const navigate = useNavigate()
  return (
    <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-md border-b border-white/[0.06]">
      <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3.5">
        <button
          onClick={onBack || (() => navigate(-1))}
          className="p-1.5 -ml-1.5 rounded-full text-on-surface hover:bg-white/5 transition-colors"
          aria-label="Back"
        >
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <h1 className="text-base font-bold text-on-surface truncate">{title}</h1>
      </div>
    </div>
  )
}
