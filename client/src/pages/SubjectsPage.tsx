import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface SubjectItem {
  id: string
  name: string
  code: string
  isActive: boolean
}

export function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [form, setForm] = useState({ name: '', code: '' })

  async function load() {
    try {
      const { data } = await api.get('/subjects?active=false')
      setSubjects(data.data)
    } catch {
      toast.error('Failed to load subjects')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function createSubject(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.post('/subjects', form)
      toast.success('Subject created')
      setForm({ name: '', code: '' })
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Create failed'
      toast.error(message)
    }
  }

  async function toggleActive(item: SubjectItem) {
    try {
      await api.patch(`/subjects/${item.id}`, { isActive: !item.isActive })
      await load()
    } catch {
      toast.error('Update failed')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Subjects</h1>
        <p className="mt-1 text-muted-foreground">Curriculum subjects for gradebooks</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add subject</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createSubject}>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                placeholder="MATH"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Create subject</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>{subjects.length} subjects</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Code</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((item) => (
                <tr key={item.id} className="border-b border-border/70">
                  <td className="py-3">{item.name}</td>
                  <td className="py-3">{item.code}</td>
                  <td className="py-3 capitalize">{item.isActive ? 'active' : 'inactive'}</td>
                  <td className="py-3">
                    <Button variant="outline" size="sm" onClick={() => toggleActive(item)}>
                      {item.isActive ? 'Deactivate' : 'Activate'}
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
