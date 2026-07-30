import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TeacherCheckInPage } from '@/pages/TeacherCheckInPage'

interface Kpis {
  date: string
  enrollment: number
  slot1: { percent: number; present: number; late: number; absent: number; total: number }
  slot2: {
    percent: number
    present: number
    late: number
    absent: number
    total: number
    truant: number
  }
  teachers: { total: number; checkedIn: number; onTime: number; late: number; missing: number }
  unexcusedAbsences: number
  finance: { collected: number; outstanding: number }
  academics: { draft: number; locked: number; released: number }
}

const roleCopy: Record<string, { title: string; body: string }> = {
  super_admin: {
    title: 'Executive overview',
    body: 'Live enrollment, dual-slot attendance, teacher punctuality, and alerts.',
  },
  staff: {
    title: 'Attendance desk',
    body: 'Open Attendance to capture Slot 1 and Slot 2 for each class.',
  },
  teacher: {
    title: 'Teacher workspace',
    body: 'Clock in each morning, then manage your assigned gradebooks.',
  },
  cashier: {
    title: 'Finance desk',
    body: 'Generate is admin-only. Collect fees, tick invoices settled, and review debtors under Finance.',
  },
}

function KpiCard({
  label,
  value,
  hint,
  alert,
}: {
  label: string
  value: string
  hint?: string
  alert?: boolean
}) {
  return (
    <Card className={alert ? 'border-destructive/40' : undefined}>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${alert ? 'text-destructive' : ''}`}>
          {value}
        </CardTitle>
      </CardHeader>
      {hint && (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      )}
    </Card>
  )
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)!
  const copy = roleCopy[user.role] || roleCopy.super_admin
  const canSeeKpis = ['super_admin', 'staff', 'cashier'].includes(user.role)

  const { data: kpis } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/kpis')
      return data.data as Kpis
    },
    enabled: canSeeKpis,
    refetchInterval: 15000,
  })

  if (user.role === 'teacher') {
    return <TeacherCheckInPage />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{copy.body}</p>
      </div>

      {canSeeKpis && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total enrollment"
            value={kpis ? String(kpis.enrollment) : '—'}
            hint="Active enrolled students"
          />
          <KpiCard
            label="Slot 1 attendance"
            value={kpis ? `${kpis.slot1.percent}%` : '—'}
            hint={
              kpis
                ? `${kpis.slot1.present + kpis.slot1.late} present / ${kpis.slot1.absent} absent`
                : 'Today AM'
            }
          />
          <KpiCard
            label="Slot 2 attendance"
            value={kpis ? `${kpis.slot2.percent}%` : '—'}
            hint={
              kpis
                ? `${kpis.slot2.present + kpis.slot2.late} present / ${kpis.slot2.absent + kpis.slot2.truant} absent`
                : 'Today PM'
            }
          />
          <KpiCard
            label="Unexcused absences"
            value={kpis ? String(kpis.unexcusedAbsences) : '—'}
            hint="Absent or truant without excuse"
            alert={Boolean(kpis && kpis.unexcusedAbsences > 0)}
          />
          {user.role === 'super_admin' && (
            <>
              <KpiCard
                label="Teachers on time"
                value={kpis ? String(kpis.teachers.onTime) : '—'}
                hint={
                  kpis
                    ? `${kpis.teachers.late} late · ${kpis.teachers.missing} missing of ${kpis.teachers.total}`
                    : 'Punctuality'
                }
                alert={Boolean(kpis && kpis.teachers.late > 0)}
              />
              <KpiCard
                label="Revenue collected"
                value={kpis ? `$${kpis.finance.collected.toLocaleString()}` : '—'}
                hint={
                  kpis
                    ? `$${kpis.finance.outstanding.toLocaleString()} outstanding`
                    : 'Finance Phase 5'
                }
              />
              <KpiCard
                label="Gradebooks locked"
                value={kpis ? String(kpis.academics.locked) : '—'}
                hint={
                  kpis
                    ? `${kpis.academics.released} released · ${kpis.academics.draft} draft`
                    : ''
                }
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
