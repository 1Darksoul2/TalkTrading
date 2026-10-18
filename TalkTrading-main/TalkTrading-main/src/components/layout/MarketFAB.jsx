import { Link, useLocation } from 'react-router-dom'

export default function MarketFAB() {
  const location = useLocation()

  // The reel action buttons occupy this corner
  if (location.pathname === '/reels') return null

  return (
    <Link
      to="/market"
      className="fixed bottom-[88px] right-4 md:hidden z-40 w-14 h-14 rounded-full bg-primary-container flex items-center justify-center shadow-lg shadow-black/30 active:scale-95 transition-transform"
      aria-label="Market Charts"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="8" width="3" height="8" rx="0.5" fill="black" />
        <rect x="10.5" y="4" width="3" height="16" rx="0.5" fill="black" />
        <rect x="17" y="10" width="3" height="4" rx="0.5" fill="black" />
      </svg>
    </Link>
  )
}
