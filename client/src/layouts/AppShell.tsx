import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Moon,
  Sun,
  GraduationCap,
  School,
  BookOpen,
  Link2,
  UserRound,
  ClipboardCheck,
  Clock,
  NotebookPen,
  Award,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/auth'

const navByRole: Record<Role, { to: string; label: string; icon: typeof Users }[]> = {
  super_admin: [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/app/attendance', label: 'Attendance', icon: ClipboardCheck },
    { to: '/app/gradebooks', label: 'Gradebooks', icon: NotebookPen },
    { to: '/app/results', label: 'Results', icon: Award },
    { to: '/app/students', label: 'Students', icon: UserRound },
    { to: '/app/classes', label: 'Classes', icon: School },
    { to: '/app/subjects', label: 'Subjects', icon: BookOpen },
    { to: '/app/assignments', label: 'Assignments', icon: Link2 },
    { to: '/app/users', label: 'Users', icon: Users },
    { to: '/app/settings', label: 'Settings', icon: Settings },
  ],
  staff: [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/app/attendance', label: 'Attendance', icon: ClipboardCheck },
    { to: '/app/students', label: 'Students', icon: UserRound },
  ],
  teacher: [
    { to: '/app', label: 'Check-in', icon: Clock },
    { to: '/app/gradebooks', label: 'Gradebooks', icon: NotebookPen },
    { to: '/app/students', label: 'Roster', icon: UserRound },
  ],
  cashier: [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/app/students', label: 'Students', icon: UserRound },
  ],
  student: [{ to: '/app', label: 'Portal', icon: LayoutDashboard }],
}

export function AppShell() {
  const user = useAuthStore((s) => s.user)!
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const links = navByRole[user.role]

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      /* ignore */
    }
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-border bg-sidebar md:border-b-0 md:border-r md:min-h-screen">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-xl leading-none tracking-tight">Smart School</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role.replace('_', ' ')}</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/app'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-muted'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-8">
          <div>
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="font-medium">{user.fullName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
