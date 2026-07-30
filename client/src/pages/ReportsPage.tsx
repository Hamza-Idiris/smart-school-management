import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { downloadReport } from '@/lib/download'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ClassItem {
  id: string
  name: string
}

const reports = [
  {
    id: 'attendance',
    title: 'Student Attendance',
    description: 'Filter by class, date range, slot, excused/unexcused/truancy',
    formats: ['pdf', 'xlsx', 'csv'] as const,
    path: '/reports/attendance',
  },
  {
    id: 'punctuality',
    title: 'Teacher Punctuality Audit',
    description: 'Arrival timestamps and late flags by month',
    formats: ['pdf', 'xlsx'] as const,
    path: '/reports/punctuality',
  },
  {
    id: 'academic',
    title: 'Academic Performance Matrix',
    description: 'Released marks with pass/fail and optional rank',
    formats: ['pdf', 'xlsx'] as const,
    path: '/reports/academic',
  },
  {
    id: 'finance',
    title: 'Financial & Fee Collection',
    description: 'Paid list, debtors, scholarships, or cashier ledger',
    formats: ['pdf', 'xlsx', 'csv'] as const,
    path: '/reports/finance',
  },
  {
    id: 'audit',
    title: 'Staff & User Audit Logs',
    description: 'Login, resets, overrides, and financial actions',
    formats: ['pdf', 'csv'] as const,
    path: '/reports/audit',
  },
]

export function ReportsPage() {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    classId: '',
    from: '',
    to: '',
    month: new Date().toISOString().slice(0, 7),
    term: 'Term 1',
    status: '',
    financeType: 'invoices',
    includeRank: true,
  })

  useEffect(() => {
    api
      .get('/classes')
      .then((res) => setClasses(res.data.data))
      .catch(() => undefined)
  }, [])

  async function download(reportId: string, path: string, format: string) {
    setBusy(`${reportId}-${format}`)
    try {
      const params: Record<string, string> = { format }
      if (reportId === 'attendance') {
        if (filters.classId) params.classId = filters.classId
        if (filters.from) params.from = filters.from
        if (filters.to) params.to = filters.to
        if (filters.status) params.status = filters.status
      }
      if (reportId === 'punctuality' && filters.month) params.month = filters.month
      if (reportId === 'academic') {
        if (filters.classId) params.classId = filters.classId
        if (filters.term) params.term = filters.term
        if (filters.includeRank) params.includeRank = 'true'
      }
      if (reportId === 'finance') {
        params.type = filters.financeType
        if (filters.month && filters.financeType !== 'payments' && filters.financeType !== 'scholarships') {
          params.month = filters.month
        }
      }
      await downloadReport(path, params, reportId)
      toast.success(`${format.toUpperCase()} downloaded`)
    } catch {
      toast.error('Download failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Reports</h1>
        <p className="mt-1 text-muted-foreground">Export PDF, Excel, or CSV for operations and audits</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shared filters</CardTitle>
          <CardDescription>Applied where relevant to each report</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Class</Label>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={filters.classId}
              onChange={(e) => setFilters((f) => ({ ...f, classId: e.target.value }))}
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>From date</Label>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>To date</Label>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Month (punctuality / finance)</Label>
            <Input
              type="month"
              value={filters.month}
              onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Term (academic)</Label>
            <Input
              value={filters.term}
              onChange={(e) => setFilters((f) => ({ ...f, term: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Attendance status</Label>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All</option>
              <option value="unexcused">Unexcused</option>
              <option value="excused">Excused</option>
              <option value="truant">Truant</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Finance report type</Label>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={filters.financeType}
              onChange={(e) => setFilters((f) => ({ ...f, financeType: e.target.value }))}
            >
              <option value="invoices">All invoices</option>
              <option value="debtors">Outstanding debtors</option>
              <option value="paid">Paid list</option>
              <option value="scholarships">Scholarship roster</option>
              <option value="payments">Cashier ledger</option>
            </select>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={filters.includeRank}
              onChange={(e) => setFilters((f) => ({ ...f, includeRank: e.target.checked }))}
            />
            Include academic rank / avg
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle className="text-lg">{report.title}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {report.formats.map((format) => (
                <Button
                  key={format}
                  variant="outline"
                  size="sm"
                  disabled={busy === `${report.id}-${format}`}
                  onClick={() => download(report.id, report.path, format)}
                >
                  {busy === `${report.id}-${format}` ? 'Preparing…' : format.toUpperCase()}
                </Button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
