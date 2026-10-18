import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

// Protected routes: send signed-out users to /login and remember where they were going.
export function RequireAuth() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

// Auth pages: signed-in users go to the app (or back to the page that sent them to /login).
export function GuestOnly() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (isAuthenticated) return <Navigate to={location.state?.from?.pathname || '/'} replace />
  return <Outlet />
}
