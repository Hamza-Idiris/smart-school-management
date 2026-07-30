import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ClassItem {
  id: string
  name: string
}

interface MasterGrid {
  class: { id: string; name: string }
  term: string
  academicYear: string
  canRelease: boolean
  allReleased: boolean
  subjects: {
    id: string
    subjectName?: string
    subjectCode?: string
    teacherName?: string
    title: string
    status: string
  }[]
  students: {
    id: string
    studentId: string
    fullName: string
    scores: {
      gradebookId: string
      subjectCode?: string
      score: number | null
      maxScore: number
      status: string
    }[]
  }[]
}

export function ReleaseResultsPage() {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [classId, setClassId] = useState('')
  const [term, setTerm] = useState('Term 1')
  const [grid, setGrid] = useState<MasterGrid | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api
      .get('/classes')
      .then((res) => setClasses(res.data.data))
      .catch(() => toast.error('Failed to load classes'))
  }, [])

  async function loadGrid() {
    if (!classId || !term) return
    setLoading(true)
    try {
      const { data } = await api.get('/gradebooks/master-grid', {
        params: { classId, term },
      })
      setGrid(data.data)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to load grid'
      toast.error(message)
      setGrid(null)
    } finally {
      setLoading(false)
    }
  }

  async function release() {
    try {
      await api.post('/gradebooks/release', { classId, term })
      toast.success('Results released to student portal')
      await loadGrid()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Release failed'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Release results</h1>
        <p className="mt-1 text-muted-foreground">
          Review the master subject grid, then release when all subjects are submitted
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Class</Label>
              <select
                className="flex h-10 min-w-[180px] rounded-md border border-border bg-card px-3 text-sm"
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
              <Label>Term</Label>
              <Input value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
            <Button onClick={loadGrid} disabled={!classId || loading}>
              {loading ? 'Loading…' : 'Load grid'}
            </Button>
            {grid?.canRelease && (
              <Button onClick={release} variant="default">
                Release class results
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {grid && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {grid.class.name} · {grid.term}
              </CardTitle>
              <CardDescription>
                {grid.allReleased
                  ? 'All subjects released'
                  : grid.canRelease
                    ? 'Ready to release'
                    : 'Waiting for all subjects to be submitted (locked)'}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Subject</th>
                    <th className="pb-2 font-medium">Teacher</th>
                    <th className="pb-2 font-medium">Title</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.subjects.map((s) => (
                    <tr key={s.id} className="border-b border-border/70">
                      <td className="py-3">
                        {s.subjectName} ({s.subjectCode})
                      </td>
                      <td className="py-3">{s.teacherName}</td>
                      <td className="py-3">{s.title}</td>
                      <td className="py-3">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xs capitalize',
                            s.status === 'draft' && 'bg-muted',
                            s.status === 'locked' &&
                              'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                            s.status === 'released' && 'bg-primary/15 text-primary'
                          )}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {grid.subjects.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-muted-foreground">
                        No gradebooks for this class/term yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {grid.students.length > 0 && grid.subjects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Score matrix</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-medium">Student</th>
                      {grid.subjects.map((s) => (
                        <th key={s.id} className="pb-2 font-medium">
                          {s.subjectCode}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.students.map((student) => (
                      <tr key={student.id} className="border-b border-border/70">
                        <td className="py-2">{student.fullName}</td>
                        {student.scores.map((score) => (
                          <td key={score.gradebookId} className="py-2 tabular-nums">
                            {score.score != null ? `${score.score}/${score.maxScore}` : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
