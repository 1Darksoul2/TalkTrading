import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { WatchlistProvider } from './context/WatchlistContext'
import { AuthProvider } from './context/AuthContext'
import { E2EProvider } from './context/E2EContext'
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
import ResetPassword from './pages/ResetPassword'
import StoryArchive from './pages/StoryArchive'
import StoryPage from './pages/StoryPage'
import PostPage from './pages/PostPage'
import HashtagPage from './pages/HashtagPage'
import NotificationsPage from './pages/NotificationsPage'
import Settings from './pages/Settings'

export default function App() {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <AuthProvider>
          <WatchlistProvider>
            <E2EProvider>
              <BrowserRouter>
                <Routes>
                  {/* Auth pages — full-page, no AppShell nav bars */}
                  <Route element={<GuestOnly />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                  </Route>

                  {/* Opened from the emailed link, signed in or not */}
                  <Route path="/reset-password" element={<ResetPassword />} />

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
                      <Route path="/market/*" element={<StockChart />} />
                      <Route path="/profile" element={<UserProfile />} />
                      <Route path="/profile/:username" element={<UserProfile />} />
                      <Route path="/stories/archive" element={<StoryArchive />} />
                      <Route path="/stories/:storyId" element={<StoryPage />} />
                      <Route path="/p/:postId" element={<PostPage />} />
                      <Route path="/tags/:tag" element={<HashtagPage />} />
                      <Route path="/notifications" element={<NotificationsPage />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/settings/:itemId" element={<Settings />} />
                    </Route>
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </E2EProvider>
          </WatchlistProvider>
        </AuthProvider>
      </PreferencesProvider>
    </ThemeProvider>
  )
}
