import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Settings {
  schoolName: string
  schoolCode: string
  teacherCutoffTime: string
  currency: string
  academicYear: string
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .get('/settings')
      .then((res) => setSettings(res.data.data))
      .catch(() => toast.error('Failed to load settings'))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!settings) return
    setSaving(true)
    try {
      const { data } = await api.patch('/settings', settings)
      setSettings(data.data)
      toast.success('Settings saved')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Save failed'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return <p className="text-muted-foreground">Loading settings…</p>
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">School profile and punctuality cutoff</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>School configuration</CardTitle>
          <CardDescription>Code: {settings.schoolCode}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={save}>
            <div className="space-y-2">
              <Label>School name</Label>
              <Input
                value={settings.schoolName}
                onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Teacher check-in cutoff (HH:MM)</Label>
              <Input
                value={settings.teacherCutoffTime}
                onChange={(e) => setSettings({ ...settings, teacherCutoffTime: e.target.value })}
                placeholder="07:30"
              />
            </div>
            <div className="space-y-2">
              <Label>Academic year</Label>
              <Input
                value={settings.academicYear}
                onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
