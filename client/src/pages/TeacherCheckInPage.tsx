import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface CheckIn {
  id: string
  date: string
  clockInAt: string
  isLate: boolean
  cutoffTime: string
}

export function TeacherCheckInPage() {
  const [today, setToday] = useState<CheckIn | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/check-ins/me/today')
      setToday(data.data)
    } catch {
      toast.error('Failed to load check-in status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function clockIn() {
    setSubmitting(true)
    try {
      const { data } = await api.post('/check-ins/clock-in')
      setToday(data.data)
      toast.success(data.data.isLate ? 'Checked in (late)' : 'Checked in on time')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Check-in failed'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Daily check-in</h1>
        <p className="mt-1 text-muted-foreground">
          Clock in when you arrive. Arrivals after the school cutoff are flagged late.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today
          </CardTitle>
          <CardDescription>
            {loading
              ? 'Loading…'
              : today
                ? `Recorded at ${new Date(today.clockInAt).toLocaleTimeString()}`
                : 'Not checked in yet'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {today ? (
            <div
              className={cn(
                'rounded-lg border px-4 py-3 text-sm',
                today.isLate
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-primary/30 bg-accent text-accent-foreground'
              )}
            >
              {today.isLate
                ? `Late — cutoff was ${today.cutoffTime}`
                : `On time — cutoff ${today.cutoffTime}`}
            </div>
          ) : (
            <Button onClick={clockIn} disabled={loading || submitting} className="w-full">
              {submitting ? 'Clocking in…' : 'Clock in'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
