import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { GuestRoute, ProtectedRoute } from '@/components/auth-guards'
import { AppShell } from '@/layouts/AppShell'
import { useAuthStore } from '@/stores/authStore'
import { LoginPage } from '@/pages/LoginPage'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { UsersPage } from '@/pages/UsersPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ClassesPage } from '@/pages/ClassesPage'
import { SubjectsPage } from '@/pages/SubjectsPage'
import { AssignmentsPage } from '@/pages/AssignmentsPage'
import { StudentsPage } from '@/pages/StudentsPage'
import { StudentPortalPage } from '@/pages/StudentPortalPage'

const queryClient = new QueryClient()

function HomeIndex() {
  const role = useAuthStore((s) => s.user?.role)
  if (role === 'student') return <StudentPortalPage />
  return <DashboardPage />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<GuestRoute />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route path="/app" element={<AppShell />}>
                <Route index element={<HomeIndex />} />
                <Route
                  element={
                    <ProtectedRoute roles={['super_admin', 'staff', 'teacher', 'cashier']} />
                  }
                >
                  <Route path="students" element={<StudentsPage />} />
                </Route>
                <Route element={<ProtectedRoute roles={['super_admin']} />}>
                  <Route path="classes" element={<ClassesPage />} />
                  <Route path="subjects" element={<SubjectsPage />} />
                  <Route path="assignments" element={<AssignmentsPage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
