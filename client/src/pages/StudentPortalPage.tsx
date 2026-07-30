import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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

export function StudentPortalPage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)

  useEffect(() => {
    api
      .get('/students/me')
      .then((res) => setProfile(res.data.data))
      .catch(() => toast.error('Could not load student profile'))
  }, [])

  if (!profile) {
    return <p className="text-muted-foreground">Loading portal…</p>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Student portal</h1>
        <p className="mt-1 text-muted-foreground">
          Attendance, report cards, and fees will appear here in later phases.
        </p>
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
    </div>
  )
}
