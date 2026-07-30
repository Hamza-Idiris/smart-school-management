import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import type { Role } from '@/types/auth'

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}

export function GuestRoute() {
  const user = useAuthStore((s) => s.user)
  if (user && !user.mustChangePassword) return <Navigate to="/app" replace />
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />
  return <Outlet />
}
