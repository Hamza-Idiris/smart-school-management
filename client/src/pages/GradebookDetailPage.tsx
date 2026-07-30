import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Entry {
  studentId: string
  studentName?: string
  studentCode?: string
  score: number | null
  maxScore: number
  remark?: string
  percent?: number | null
}

interface Gradebook {
  id: string
  title: string
  term: string
  academicYear: string
  className?: string
  subjectName?: string
  status: 'draft' | 'locked' | 'released'
  entries: Entry[]
}

export function GradebookDetailPage() {
  const { id } = useParams()
  const role = useAuthStore((s) => s.user?.role)
  const [book, setBook] = useState<Gradebook | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { data } = await api.get(`/gradebooks/${id}`)
      setBook(data.data)
      setEntries(data.data.entries)
    } catch {
      toast.error('Failed to load gradebook')
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  async function saveDraft() {
    setSaving(true)
    try {
      const { data } = await api.put(`/gradebooks/${id}/entries`, {
        entries: entries.map((e) => ({
          studentId: e.studentId,
          score: e.score,
          maxScore: e.maxScore,
          remark: e.remark || '',
        })),
      })
      setBook(data.data)
      setEntries(data.data.entries)
      toast.success('Draft saved')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Save failed'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function submit() {
    setSaving(true)
    try {
      await api.put(`/gradebooks/${id}/entries`, {
        entries: entries.map((e) => ({
          studentId: e.studentId,
          score: e.score,
          maxScore: e.maxScore,
          remark: e.remark || '',
        })),
      })
      const { data } = await api.post(`/gradebooks/${id}/submit`)
      setBook(data.data)
      setEntries(data.data.entries)
      toast.success('Submitted and locked')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Submit failed'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function unlock() {
    try {
      const { data } = await api.post(`/gradebooks/${id}/unlock`)
      setBook(data.data)
      setEntries(data.data.entries)
      toast.success('Unlocked for editing')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Unlock failed'
      toast.error(message)
    }
  }

  if (!book) return <p className="text-muted-foreground">Loading gradebook…</p>

  const editable = book.status === 'draft'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/app/gradebooks" className="text-sm text-muted-foreground hover:text-foreground">
            ← Gradebooks
          </Link>
          <h1 className="mt-2 font-display text-3xl tracking-tight">{book.title}</h1>
          <p className="mt-1 text-muted-foreground">
            {book.className} · {book.subjectName} · {book.term} · {book.academicYear}
          </p>
        </div>
        <span
          className={cn(
            'rounded-md px-2.5 py-1 text-xs capitalize',
            book.status === 'draft' && 'bg-muted',
            book.status === 'locked' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
            book.status === 'released' && 'bg-primary/15 text-primary'
          )}
        >
          {book.status}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Marks</CardTitle>
          <CardDescription>
            {editable ? 'Edit scores then save or submit to lock' : 'Read-only while locked/released'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Student</th>
                  <th className="pb-2 font-medium">ID</th>
                  <th className="pb-2 font-medium">Score</th>
                  <th className="pb-2 font-medium">Max</th>
                  <th className="pb-2 font-medium">%</th>
                  <th className="pb-2 font-medium">Remark</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const percent =
                    entry.score != null && entry.maxScore
                      ? Math.round((Number(entry.score) / Number(entry.maxScore)) * 1000) / 10
                      : null
                  return (
                    <tr key={entry.studentId} className="border-b border-border/70">
                      <td className="py-2">{entry.studentName}</td>
                      <td className="py-2">{entry.studentCode}</td>
                      <td className="py-2">
                        <Input
                          type="number"
                          min={0}
                          className="h-9 w-24"
                          disabled={!editable}
                          value={entry.score ?? ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? null : Number(e.target.value)
                            setEntries((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, score: value } : r))
                            )
                          }}
                        />
                      </td>
                      <td className="py-2">
                        <Input
                          type="number"
                          min={1}
                          className="h-9 w-20"
                          disabled={!editable}
                          value={entry.maxScore}
                          onChange={(e) => {
                            const value = Number(e.target.value) || 100
                            setEntries((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, maxScore: value } : r))
                            )
                          }}
                        />
                      </td>
                      <td className="py-2 tabular-nums">{percent ?? '—'}</td>
                      <td className="py-2">
                        <Input
                          className="h-9"
                          disabled={!editable}
                          value={entry.remark || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            setEntries((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, remark: value } : r))
                            )
                          }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            {editable && (
              <>
                <Button variant="secondary" onClick={saveDraft} disabled={saving}>
                  Save draft
                </Button>
                <Button onClick={submit} disabled={saving}>
                  Submit to admin
                </Button>
              </>
            )}
            {role === 'super_admin' && book.status === 'locked' && (
              <Button variant="outline" onClick={unlock}>
                Unlock for edits
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
