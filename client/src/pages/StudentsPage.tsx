import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ClassItem {
  id: string
  name: string
}

interface StudentItem {
  id: string
  studentId: string
  fullName: string
  className?: string | null
  feeTag: string
  status: string
  parent?: { primaryPhone?: string }
  temporaryPassword?: string
}

const emptyForm = {
  studentId: '',
  fullName: '',
  dateOfBirth: '',
  gender: '',
  classId: '',
  feeTag: 'standard',
  discountType: 'percent',
  discountValue: '',
  parentFullName: '',
  primaryPhone: '',
  secondaryPhone: '',
  whatsappNumber: '',
}

export function StudentsPage() {
  const role = useAuthStore((s) => s.user?.role)
  const canManage = role === 'super_admin'
  const [students, setStudents] = useState<StudentItem[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [q, setQ] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  async function load(search = q) {
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : ''
      const [s, c] = await Promise.all([api.get(`/students${params}`), api.get('/classes')])
      setStudents(s.data.data)
      setClasses(c.data.data)
    } catch {
      toast.error('Failed to load students')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function createStudent(e: React.FormEvent) {
    e.preventDefault()
    try {
      const payload: Record<string, unknown> = {
        studentId: form.studentId,
        fullName: form.fullName,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        classId: form.classId || undefined,
        feeTag: form.feeTag,
        parent: {
          fullName: form.parentFullName,
          primaryPhone: form.primaryPhone,
          secondaryPhone: form.secondaryPhone,
          whatsappNumber: form.whatsappNumber,
        },
        createPortal: true,
      }
      if (form.feeTag === 'discounted') {
        payload.discountType = form.discountType
        payload.discountValue = Number(form.discountValue)
      }
      const { data } = await api.post('/students', payload)
      setTempPassword(data.data.temporaryPassword || null)
      toast.success(`Registered ${data.data.studentId}`)
      setForm(emptyForm)
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Create failed'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Students</h1>
        <p className="mt-1 text-muted-foreground">
          Onboard students with parent contacts and fee designation
        </p>
      </div>

      {canManage && tempPassword && (
        <Card className="border-primary/40 bg-accent/40">
          <CardHeader>
            <CardTitle className="text-base">Student portal password</CardTitle>
            <CardDescription>
              Username is the student ID (lowercase). Share this temporary password securely.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="rounded bg-muted px-2 py-1 text-sm">{tempPassword}</code>
          </CardContent>
        </Card>
      )}

      {canManage && (
      <Card>
        <CardHeader>
          <CardTitle>Register student</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createStudent}>
            <div className="space-y-2">
              <Label>Student ID</Label>
              <Input
                value={form.studentId}
                onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Date of birth</Label>
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Class</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                value={form.classId}
                onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Fee tag</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                value={form.feeTag}
                onChange={(e) => setForm((f) => ({ ...f, feeTag: e.target.value }))}
              >
                <option value="standard">Paid / Standard</option>
                <option value="scholarship">Free / Scholarship</option>
                <option value="discounted">Discounted</option>
              </select>
            </div>
            {form.feeTag === 'discounted' && (
              <>
                <div className="space-y-2">
                  <Label>Discount type</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                    value={form.discountType}
                    onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}
                  >
                    <option value="percent">Percent</option>
                    <option value="amount">Amount</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Discount value</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.discountValue}
                    onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                    required
                  />
                </div>
              </>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label>Parent / guardian name</Label>
              <Input
                value={form.parentFullName}
                onChange={(e) => setForm((f) => ({ ...f, parentFullName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Primary phone</Label>
              <Input
                value={form.primaryPhone}
                onChange={(e) => setForm((f) => ({ ...f, primaryPhone: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp number</Label>
              <Input
                value={form.whatsappNumber}
                onChange={(e) => setForm((f) => ({ ...f, whatsappNumber: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Register student</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Roster</CardTitle>
          <CardDescription>{students.length} students</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void load(q)
            }}
          >
            <Input
              className="max-w-xs"
              placeholder="Search name or ID"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">ID</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Class</th>
                  <th className="pb-2 font-medium">Fee</th>
                  <th className="pb-2 font-medium">Phone</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-b border-border/70">
                    <td className="py-3 font-medium">{s.studentId}</td>
                    <td className="py-3">{s.fullName}</td>
                    <td className="py-3">{s.className || '—'}</td>
                    <td className="py-3 capitalize">{s.feeTag}</td>
                    <td className="py-3">{s.parent?.primaryPhone || '—'}</td>
                    <td className="py-3 capitalize">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
