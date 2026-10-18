import { Outlet, useLocation } from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'
import TopAppBar from './TopAppBar'
import BottomNavBar from './BottomNavBar'
import MarketFAB from './MarketFAB'
import SessionBanner from './SessionBanner'

function PageCrashed({ error, resetErrorBoundary }) {
  return (
    <div role="alert" className="max-w-md mx-auto text-center py-20 px-4 space-y-3">
      <span className="material-symbols-outlined text-5xl text-on-surface-muted">error</span>
      <h1 className="text-lg font-semibold text-on-surface">Something went wrong on this page</h1>
      <p className="text-sm text-on-surface-muted break-words">{error?.message}</p>
      <button onClick={resetErrorBoundary} className="px-5 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold">Try again</button>
    </div>
  )
}

export default function AppShell() {
  const location = useLocation()
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <TopAppBar />
      <main className="pt-16 pb-20 md:pb-0">
        <SessionBanner />
        {/* A crash inside one page shows a message there instead of blanking the whole app; it resets on navigation. */}
        <ErrorBoundary FallbackComponent={PageCrashed} resetKeys={[location.pathname]}
          onError={error => console.error('Page crashed:', error)}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <MarketFAB />
      <BottomNavBar />
    </div>
  )
}
