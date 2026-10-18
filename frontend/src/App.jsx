import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { WatchlistProvider } from './context/WatchlistContext'
import { E2EProvider } from './context/E2EContext'
import { PreferencesProvider } from './context/PreferencesContext'
import AppShell from './components/layout/AppShell'
import RequireAuth from './components/layout/RequireAuth'
import Login from './pages/Login'
import HomeFeed from './pages/HomeFeed'
import UserProfile from './pages/UserProfile'
import Chats from './pages/Chats'
import MarketCharts from './pages/MarketCharts'
import StockChart from './pages/StockChart'
import MarketNews from './pages/MarketNews'
import Communities from './pages/Communities'
import ExploreSearch from './pages/ExploreSearch'
import StoryArchive from './pages/StoryArchive'
import PostPage from './pages/PostPage'
import HashtagPage from './pages/HashtagPage'
import StoryPage from './pages/StoryPage'
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
                  <Route path="/login" element={<Login />} />
                  <Route element={<RequireAuth />}>
                    <Route element={<AppShell />}>
                      <Route path="/" element={<HomeFeed />} />
                      <Route path="/communities" element={<Communities />} />
                      <Route path="/explore" element={<ExploreSearch />} />
                      <Route path="/chats" element={<Chats />} />
                      <Route path="/chats/:chatId" element={<Chats />} />
                      <Route path="/news" element={<MarketNews />} />
                      <Route path="/market" element={<MarketCharts />} />
                      <Route path="/market/*" element={<StockChart />} />
                      <Route path="/profile" element={<UserProfile />} />
                      <Route path="/profile/:username" element={<UserProfile />} />
                      <Route path="/stories/archive" element={<StoryArchive />} />
                      <Route path="/p/:postId" element={<PostPage />} />
                      <Route path="/tags/:tag" element={<HashtagPage />} />
                      <Route path="/stories/:storyId" element={<StoryPage />} />
                      <Route path="/notifications" element={<NotificationsPage />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/settings/:itemId" element={<Settings />} />
                    </Route>
                  </Route>
                </Routes>
              </BrowserRouter>
          </E2EProvider>
        </WatchlistProvider>
      </AuthProvider>
      </PreferencesProvider>
    </ThemeProvider>
  )
}
