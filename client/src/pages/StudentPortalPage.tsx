import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
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

interface ReportSubject {
  subjectName?: string
  subjectCode?: string
  title: string
  term: string
  score: number | null
  maxScore: number
  percent: number | null
  remark?: string
}

interface FeeInvoice {
  id: string
  month: string
  amountDue: number
  amountPaid: number
  balance: number
  status: string
}

export function StudentPortalPage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [subjects, setSubjects] = useState<ReportSubject[]>([])
  const [average, setAverage] = useState<number | null>(null)
  const [fees, setFees] = useState<{ outstanding: number; invoices: FeeInvoice[] } | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/students/me'),
      api.get('/attendance/me'),
      api.get('/gradebooks/me/report-card'),
      api.get('/finance/me'),
    ])
      .then(([p, a, r, f]) => {
        setProfile(p.data.data)
        setAttendance(a.data.data)
        setSubjects(r.data.data.subjects)
        setAverage(r.data.data.averagePercent)
        setFees(f.data.data)
      })
      .catch(() => toast.error('Could not load student portal'))
  }, [])

  async function downloadPdf() {
    setDownloading(true)
    try {
      const res = await api.get('/gradebooks/me/report-card.pdf', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `report-card-${profile?.studentId || 'student'}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('PDF download failed')
    } finally {
      setDownloading(false)
    }
  }

  if (!profile) {
    return <p className="text-muted-foreground">Loading portal…</p>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Student portal</h1>
        <p className="mt-1 text-muted-foreground">Profile, attendance, and released report cards</p>
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
          <CardTitle>Fees</CardTitle>
          <CardDescription>
            {fees
              ? fees.outstanding > 0
                ? `Outstanding $${fees.outstanding.toLocaleString()}`
                : 'No outstanding balance'
              : 'Fee summary'}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Month</th>
                <th className="pb-2 font-medium">Due</th>
                <th className="pb-2 font-medium">Paid</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(fees?.invoices || []).map((inv) => (
                <tr key={inv.id} className="border-b border-border/70">
                  <td className="py-2">{inv.month}</td>
                  <td className="py-2 tabular-nums">${inv.amountDue}</td>
                  <td className="py-2 tabular-nums">${inv.amountPaid}</td>
                  <td className="py-2 capitalize">{inv.status}</td>
                </tr>
              ))}
              {(!fees || fees.invoices.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-4 text-muted-foreground">
                    No fee invoices yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Report card</CardTitle>
            <CardDescription>
              {average != null ? `Average ${average}%` : 'Released results only'}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={downloadPdf} disabled={downloading}>
            {downloading ? 'Preparing…' : 'Download PDF'}
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Subject</th>
                <th className="pb-2 font-medium">Term</th>
                <th className="pb-2 font-medium">Score</th>
                <th className="pb-2 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((row, i) => (
                <tr key={`${row.subjectCode}-${row.term}-${i}`} className="border-b border-border/70">
                  <td className="py-2">
                    {row.subjectName} ({row.subjectCode})
                  </td>
                  <td className="py-2">{row.term}</td>
                  <td className="py-2 tabular-nums">
                    {row.score != null ? `${row.score}/${row.maxScore}` : '—'}
                  </td>
                  <td className="py-2 tabular-nums">{row.percent ?? '—'}</td>
                </tr>
              ))}
              {subjects.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-muted-foreground">
                    No released results yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
