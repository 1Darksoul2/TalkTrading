import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { WatchlistProvider } from './context/WatchlistContext'
import { AuthProvider } from './context/AuthContext'
import { E2EProvider } from './context/E2EContext'
import { RequireAuth, GuestOnly } from './components/auth/RequireAuth'
import AppShell from './components/layout/AppShell'
import HomeFeed from './pages/HomeFeed'
import Login from './pages/Login'

// Every page except the feed and sign-in loads on first visit, so the app starts faster.
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const UserProfile = lazy(() => import('./pages/UserProfile'))
const Chats = lazy(() => import('./pages/Chats'))
const MarketCharts = lazy(() => import('./pages/MarketCharts'))
const StockChart = lazy(() => import('./pages/StockChart'))
const MarketNews = lazy(() => import('./pages/MarketNews'))
const Communities = lazy(() => import('./pages/Communities'))
const ExploreSearch = lazy(() => import('./pages/ExploreSearch'))
const Reels = lazy(() => import('./pages/Reels'))
const Create = lazy(() => import('./pages/Create'))
const StoryArchive = lazy(() => import('./pages/StoryArchive'))
const StoryPage = lazy(() => import('./pages/StoryPage'))
const PostPage = lazy(() => import('./pages/PostPage'))
const HashtagPage = lazy(() => import('./pages/HashtagPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const Settings = lazy(() => import('./pages/Settings'))
const Feedback = lazy(() => import('./pages/Feedback'))
const Status = lazy(() => import('./pages/Status'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Terms = lazy(() => import('./pages/legal/Terms'))
const Privacy = lazy(() => import('./pages/legal/Privacy'))
const Guidelines = lazy(() => import('./pages/legal/Guidelines'))

function Loading() {
  return <div className="flex justify-center py-24 text-on-surface-muted text-sm">Loading…</div>
}

export default function App() {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <AuthProvider>
          <WatchlistProvider>
            <E2EProvider>
              <BrowserRouter>
                <Suspense fallback={<Loading />}>
                  <Routes>
                    {/* Auth pages — full-page, no AppShell nav bars */}
                    <Route element={<GuestOnly />}>
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                    </Route>

                    {/* Readable by anyone, signed in or not */}
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/guidelines" element={<Guidelines />} />

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
                        <Route path="/feedback" element={<Feedback />} />
                        <Route path="/status" element={<Status />} />
                        <Route path="*" element={<NotFound />} />
                      </Route>
                    </Route>
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </E2EProvider>
          </WatchlistProvider>
        </AuthProvider>
      </PreferencesProvider>
    </ThemeProvider>
  )
}
