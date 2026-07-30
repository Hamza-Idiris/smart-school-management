import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ClassItem {
  id: string
  name: string
  gradeLevel?: string
  section?: string
  academicYear: string
  isActive: boolean
}

export function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [form, setForm] = useState({ name: '', gradeLevel: '', section: '', academicYear: '' })

  async function load() {
    try {
      const { data } = await api.get('/classes?active=false')
      setClasses(data.data)
    } catch {
      toast.error('Failed to load classes')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function createClass(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.post('/classes', {
        ...form,
        academicYear: form.academicYear || undefined,
      })
      toast.success('Class created')
      setForm({ name: '', gradeLevel: '', section: '', academicYear: '' })
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Create failed'
      toast.error(message)
    }
  }

  async function toggleActive(item: ClassItem) {
    try {
      await api.patch(`/classes/${item.id}`, { isActive: !item.isActive })
      await load()
    } catch {
      toast.error('Update failed')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Classes</h1>
        <p className="mt-1 text-muted-foreground">Define grade levels and sections</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add class</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createClass}>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="Grade 8A"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Grade level</Label>
              <Input
                placeholder="8"
                value={form.gradeLevel}
                onChange={(e) => setForm((f) => ({ ...f, gradeLevel: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <Input
                placeholder="A"
                value={form.section}
                onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Academic year</Label>
              <Input
                placeholder="Uses school default if empty"
                value={form.academicYear}
                onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Create class</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>{classes.length} classes</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Grade</th>
                <th className="pb-2 font-medium">Year</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((item) => (
                <tr key={item.id} className="border-b border-border/70">
                  <td className="py-3">{item.name}</td>
                  <td className="py-3">{item.gradeLevel || '—'}</td>
                  <td className="py-3">{item.academicYear}</td>
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
