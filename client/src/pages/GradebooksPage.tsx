import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface GradebookSummary {
  id: string
  title: string
  term: string
  academicYear: string
  className?: string
  subjectName?: string
  subjectCode?: string
  status: 'draft' | 'locked' | 'released'
  teacherName?: string
}

interface Assignment {
  id: string
  classId: string
  className?: string
  subjectId: string
  subjectName?: string
  subjectCode?: string
}

export function GradebooksPage() {
  const role = useAuthStore((s) => s.user?.role)
  const navigate = useNavigate()
  const [items, setItems] = useState<GradebookSummary[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [form, setForm] = useState({
    assignmentKey: '',
    term: 'Term 1',
    title: 'Exam',
  })

  async function load() {
    try {
      const [g, a] = await Promise.all([
        api.get('/gradebooks'),
        role === 'teacher' || role === 'super_admin'
          ? api.get('/assignments')
          : Promise.resolve({ data: { data: [] } }),
      ])
      setItems(g.data.data)
      setAssignments(a.data.data)
    } catch {
      toast.error('Failed to load gradebooks')
    }
  }

  useEffect(() => {
    void load()
  }, [role])

  async function createGradebook(e: React.FormEvent) {
    e.preventDefault()
    const assignment = assignments.find((a) => a.id === form.assignmentKey)
    if (!assignment) {
      toast.error('Select an assignment')
      return
    }
    try {
      const { data } = await api.post('/gradebooks', {
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        term: form.term,
        title: form.title,
      })
      toast.success('Gradebook created')
      navigate(`/app/gradebooks/${data.data.id}`)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Create failed'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Gradebooks</h1>
          <p className="mt-1 text-muted-foreground">Enter marks, submit to lock, await release</p>
        </div>
        {role === 'super_admin' && (
          <Link
            to="/app/results"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Master grid / release
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New gradebook</CardTitle>
          <CardDescription>Uses your teacher–class–subject assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-4" onSubmit={createGradebook}>
            <div className="space-y-2 md:col-span-2">
              <Label>Assignment</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                value={form.assignmentKey}
                onChange={(e) => setForm((f) => ({ ...f, assignmentKey: e.target.value }))}
                required
              >
                <option value="">Select class / subject</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.className} — {a.subjectName} ({a.subjectCode})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Term</Label>
              <Input
                value={form.term}
                onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div className="md:col-span-4">
              <Button type="submit">Create gradebook</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All gradebooks</CardTitle>
          <CardDescription>{items.length} records</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Title</th>
                <th className="pb-2 font-medium">Class</th>
                <th className="pb-2 font-medium">Subject</th>
                <th className="pb-2 font-medium">Term</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border/70">
                  <td className="py-3">{item.title}</td>
                  <td className="py-3">{item.className}</td>
                  <td className="py-3">
                    {item.subjectName} ({item.subjectCode})
                  </td>
                  <td className="py-3">{item.term}</td>
                  <td className="py-3">
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs capitalize',
                        item.status === 'draft' && 'bg-muted',
                        item.status === 'locked' &&
                          'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                        item.status === 'released' && 'bg-primary/15 text-primary'
                      )}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      to={`/app/gradebooks/${item.id}`}
                      className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
                    >
                      Open
                    </Link>
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
