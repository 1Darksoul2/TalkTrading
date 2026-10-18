import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { WatchlistProvider } from './context/WatchlistContext'
import { AuthProvider } from './context/AuthContext'
import { RequireAuth, GuestOnly } from './components/auth/RequireAuth'
import AppShell from './components/layout/AppShell'
import HomeFeed from './pages/HomeFeed'
import UserProfile from './pages/UserProfile'
import Chats from './pages/Chats'
import MarketCharts from './pages/MarketCharts'
import StockChart from './pages/StockChart'
import MarketNews from './pages/MarketNews'
import Communities from './pages/Communities'
import ExploreSearch from './pages/ExploreSearch'
import Reels from './pages/Reels'
import Create from './pages/Create'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WatchlistProvider>
          <BrowserRouter>
            <Routes>
              {/* Auth pages — full-page, no AppShell nav bars */}
              <Route element={<GuestOnly />}>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
              </Route>

              {/* Main app shell with nav — signed-in users only */}
              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<HomeFeed />} />
                  <Route path="/communities" element={<Communities />} />
                  <Route path="/explore" element={<ExploreSearch />} />
                  <Route path="/reels" element={<Reels />} />
                  <Route path="/create" element={<Create />} />
                  <Route path="/chats" element={<Chats />} />
                  <Route path="/chats/:chatId" element={<Chats />} />
                  <Route path="/news" element={<MarketNews />} />
                  <Route path="/market" element={<MarketCharts />} />
                  <Route path="/market/:symbol" element={<StockChart />} />
                  <Route path="/profile" element={<UserProfile />} />
                  <Route path="/profile/:username" element={<UserProfile />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </WatchlistProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
