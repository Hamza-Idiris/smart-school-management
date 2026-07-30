import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ClassItem {
  id: string
  name: string
}

interface StudentRow {
  id: string
  studentId: string
  fullName: string
}

type MarkStatus = 'present' | 'absent' | 'late'

const statusOptions: MarkStatus[] = ['present', 'absent', 'late']

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function AttendancePage() {
  const role = useAuthStore((s) => s.user?.role)
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(today())
  const [slot, setSlot] = useState<1 | 2>(1)
  const [students, setStudents] = useState<StudentRow[]>([])
  const [marks, setMarks] = useState<Record<string, MarkStatus>>({})
  const [sessions, setSessions] = useState<
    { slot: number; marks: { studentId: string; status: string; note?: string }[] }[]
  >([])
  const [unexcused, setUnexcused] = useState<
    {
      sessionId: string
      studentId: string
      studentName?: string
      studentCode?: string
      className?: string
      slot: number
      status: string
    }[]
  >([])
  const [excuseNote, setExcuseNote] = useState('')
  const [excuseTarget, setExcuseTarget] = useState<{ sessionId: string; studentId: string } | null>(
    null
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .get('/classes')
      .then((res) => setClasses(res.data.data))
      .catch(() => toast.error('Failed to load classes'))
  }, [])

  async function loadRoster(nextClass = classId, nextDate = date) {
    if (!nextClass) return
    try {
      const { data } = await api.get('/attendance/roster', {
        params: { classId: nextClass, date: nextDate },
      })
      setStudents(data.data.students)
      setSessions(data.data.sessions)
      const existing = data.data.sessions.find((s: { slot: number }) => s.slot === slot)
      const nextMarks: Record<string, MarkStatus> = {}
      for (const s of data.data.students as StudentRow[]) {
        const prior = existing?.marks?.find(
          (m: { studentId: string }) => m.studentId === s.id || m.studentId?.toString?.() === s.id
        )
        nextMarks[s.id] = (prior?.status === 'truant' || prior?.status === 'excused'
          ? 'absent'
          : prior?.status) || 'present'
      }
      setMarks(nextMarks)
    } catch {
      toast.error('Failed to load roster')
    }
  }

  async function loadUnexcused() {
    if (role !== 'super_admin') return
    try {
      const { data } = await api.get('/attendance/unexcused', { params: { date } })
      setUnexcused(data.data)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadRoster()
    void loadUnexcused()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date, slot])

  const existingSlot = useMemo(
    () => sessions.find((s) => s.slot === slot),
    [sessions, slot]
  )

  function markAll(status: MarkStatus) {
    const next: Record<string, MarkStatus> = {}
    for (const s of students) next[s.id] = status
    setMarks(next)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!classId) {
      toast.error('Select a class')
      return
    }
    setSaving(true)
    try {
      await api.post('/attendance/sessions', {
        classId,
        date,
        slot,
        marks: students.map((s) => ({
          studentId: s.id,
          status: marks[s.id] || 'present',
        })),
      })
      toast.success(`Slot ${slot} submitted`)
      await loadRoster()
      await loadUnexcused()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Submit failed'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function submitExcuse(e: React.FormEvent) {
    e.preventDefault()
    if (!excuseTarget) return
    try {
      await api.patch(
        `/attendance/sessions/${excuseTarget.sessionId}/excuse/${excuseTarget.studentId}`,
        { note: excuseNote }
      )
      toast.success('Absence excused')
      setExcuseTarget(null)
      setExcuseNote('')
      await loadRoster()
      await loadUnexcused()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Excuse failed'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Attendance</h1>
        <p className="mt-1 text-muted-foreground">
          Dual-slot capture. Slot 2 marks Present→Absent as truant automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Capture session</CardTitle>
          <CardDescription>
            {existingSlot ? `Slot ${slot} already submitted — resubmit to update` : `New Slot ${slot} log`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Slot</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                value={slot}
                onChange={(e) => setSlot(Number(e.target.value) as 1 | 2)}
              >
                <option value={1}>Slot 1 — Before break</option>
                <option value={2}>Slot 2 — After break</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="button" variant="secondary" onClick={() => markAll('present')}>
                All present
              </Button>
              <Button type="button" variant="outline" onClick={() => markAll('absent')}>
                All absent
              </Button>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Student</th>
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-b border-border/70">
                      <td className="px-3 py-2">{s.fullName}</td>
                      <td className="px-3 py-2">{s.studentId}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {statusOptions.map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => setMarks((m) => ({ ...m, [s.id]: status }))}
                              className={cn(
                                'rounded-md px-2.5 py-1 text-xs capitalize transition-colors',
                                marks[s.id] === status
                                  ? status === 'present'
                                    ? 'bg-primary text-primary-foreground'
                                    : status === 'late'
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-destructive text-white'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              )}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!classId && (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-muted-foreground">
                        Select a class to load the roster
                      </td>
                    </tr>
                  )}
                  {classId && students.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-muted-foreground">
                        No active students in this class
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Button type="submit" disabled={!classId || students.length === 0 || saving}>
              {saving ? 'Saving…' : `Submit Slot ${slot}`}
            </Button>
          </form>
        </CardContent>
      </Card>

      {role === 'super_admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Unexcused absences</CardTitle>
            <CardDescription>For {date} — excuse with a mandatory note</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {excuseTarget && (
              <form className="flex flex-wrap items-end gap-2" onSubmit={submitExcuse}>
                <div className="min-w-[240px] flex-1 space-y-2">
                  <Label>Excuse note</Label>
                  <Input
                    value={excuseNote}
                    onChange={(e) => setExcuseNote(e.target.value)}
                    required
                    placeholder="Parent called / medical…"
                  />
                </div>
                <Button type="submit">Save excuse</Button>
                <Button type="button" variant="ghost" onClick={() => setExcuseTarget(null)}>
                  Cancel
                </Button>
              </form>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Student</th>
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium">Slot</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unexcused.map((row) => (
                    <tr
                      key={`${row.sessionId}-${row.studentId}`}
                      className="border-b border-border/70"
                    >
                      <td className="py-3">
                        {row.studentName} ({row.studentCode})
                      </td>
                      <td className="py-3">{row.className}</td>
                      <td className="py-3">{row.slot}</td>
                      <td className="py-3 capitalize text-destructive">{row.status}</td>
                      <td className="py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setExcuseTarget({
                              sessionId: row.sessionId,
                              studentId: row.studentId,
                            })
                          }
                        >
                          Excuse
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {unexcused.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-muted-foreground">
                        No unexcused absences for this date
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
