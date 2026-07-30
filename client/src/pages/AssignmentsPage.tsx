import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Option {
  id: string
  fullName?: string
  name?: string
  code?: string
}

interface Assignment {
  id: string
  teacherName?: string
  className?: string
  subjectName?: string
  subjectCode?: string
  academicYear: string
}

export function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [teachers, setTeachers] = useState<Option[]>([])
  const [classes, setClasses] = useState<Option[]>([])
  const [subjects, setSubjects] = useState<Option[]>([])
  const [form, setForm] = useState({ teacherId: '', classId: '', subjectId: '' })

  async function load() {
    try {
      const [a, u, c, s] = await Promise.all([
        api.get('/assignments'),
        api.get('/users?role=teacher&status=active'),
        api.get('/classes'),
        api.get('/subjects'),
      ])
      setAssignments(a.data.data)
      setTeachers(u.data.data)
      setClasses(c.data.data)
      setSubjects(s.data.data)
    } catch {
      toast.error('Failed to load assignments data')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.post('/assignments', form)
      toast.success('Assignment created')
      setForm({ teacherId: '', classId: '', subjectId: '' })
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Create failed'
      toast.error(message)
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/assignments/${id}`)
      toast.success('Assignment removed')
      await load()
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Teacher assignments</h1>
        <p className="mt-1 text-muted-foreground">Link teachers to class subjects</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={createAssignment}>
            <div className="space-y-2">
              <Label>Teacher</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                value={form.teacherId}
                onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
                required
              >
                <option value="">Select teacher</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Class</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                value={form.classId}
                onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
                required
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
              <Label>Subject</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                value={form.subjectId}
                onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
                required
              >
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Assign</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current assignments</CardTitle>
          <CardDescription>{assignments.length} links</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Teacher</th>
                <th className="pb-2 font-medium">Class</th>
                <th className="pb-2 font-medium">Subject</th>
                <th className="pb-2 font-medium">Year</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b border-border/70">
                  <td className="py-3">{a.teacherName}</td>
                  <td className="py-3">{a.className}</td>
                  <td className="py-3">
                    {a.subjectName} ({a.subjectCode})
                  </td>
                  <td className="py-3">{a.academicYear}</td>
                  <td className="py-3">
                    <Button variant="outline" size="sm" onClick={() => remove(a.id)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
