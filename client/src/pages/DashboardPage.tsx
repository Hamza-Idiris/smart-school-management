import { useAuthStore } from '@/stores/authStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const roleCopy: Record<string, { title: string; body: string }> = {
  super_admin: {
    title: 'Executive overview',
    body: 'Enrollment, dual-slot attendance, teacher punctuality, finance, and academic status will appear here as modules come online.',
  },
  staff: {
    title: 'Attendance desk',
    body: 'Capture Slot 1 and Slot 2 attendance for assigned classes. Truancy flags update the admin dashboard automatically.',
  },
  teacher: {
    title: 'Teacher workspace',
    body: 'Clock in each morning, open assigned class rosters, and submit gradebooks for admin release.',
  },
  cashier: {
    title: 'Finance desk',
    body: 'Collect fees, tick invoices as settled, and review outstanding debtors.',
  },
  student: {
    title: 'Student portal',
    body: 'View published report cards, daily attendance, and fee status once your records are linked.',
  },
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)!
  const copy = roleCopy[user.role]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{copy.body}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {['Students', 'Slot 1', 'Slot 2', 'Revenue'].map((label) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">—</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Live KPIs land in Phase 3–5</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
