import { Outlet } from 'react-router-dom'
import TopAppBar from './TopAppBar'
import BottomNavBar from './BottomNavBar'
import MarketFAB from './MarketFAB'
import SideNavBar from './SideNavBar'

export default function AppShell() {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <TopAppBar />
      <SideNavBar />
      <main className="pt-16 pb-20 md:pb-0 md:pl-14">
        <Outlet />
      </main>
      <MarketFAB />
      <BottomNavBar />
    </div>
  )
}
