import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StudentProfile {
  studentId: string
  fullName: string
  className?: string | null
  feeTag: string
  status: string
  parent?: {
    fullName?: string
    primaryPhone?: string
    whatsappNumber?: string
  }
}

interface AttendanceRow {
  date: string
  slot: number
  className?: string
  status?: string
  note?: string
}

export function StudentPortalPage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])

  useEffect(() => {
    Promise.all([api.get('/students/me'), api.get('/attendance/me')])
      .then(([p, a]) => {
        setProfile(p.data.data)
        setAttendance(a.data.data)
      })
      .catch(() => toast.error('Could not load student portal'))
  }, [])

  if (!profile) {
    return <p className="text-muted-foreground">Loading portal…</p>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Student portal</h1>
        <p className="mt-1 text-muted-foreground">Profile and daily attendance logs</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{profile.fullName}</CardTitle>
          <CardDescription>ID {profile.studentId}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Class</p>
            <p className="font-medium">{profile.className || 'Unassigned'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fee status</p>
            <p className="font-medium capitalize">{profile.feeTag}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Parent phone</p>
            <p className="font-medium">{profile.parent?.primaryPhone || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Enrollment</p>
            <p className="font-medium capitalize">{profile.status}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
          <CardDescription>Recent dual-slot records</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Slot</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((row) => (
                <tr key={`${row.date}-${row.slot}`} className="border-b border-border/70">
                  <td className="py-2">{row.date}</td>
                  <td className="py-2">{row.slot}</td>
                  <td
                    className={cn(
                      'py-2 capitalize',
                      row.status === 'truant' || row.status === 'absent'
                        ? 'text-destructive'
                        : row.status === 'late'
                          ? 'text-amber-600'
                          : ''
                    )}
                  >
                    {row.status || '—'}
                  </td>
                </tr>
              ))}
              {attendance.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-muted-foreground">
                    No attendance records yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
