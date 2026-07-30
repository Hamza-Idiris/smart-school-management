import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AppUser {
  id: string
  username: string
  fullName: string
  role: string
  status: string
  email?: string
  temporaryPassword?: string
}

export function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    username: '',
    fullName: '',
    email: '',
    role: 'teacher',
  })
  const [createdTemp, setCreatedTemp] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/users')
      setUsers(data.data)
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    try {
      const { data } = await api.post('/users', form)
      setCreatedTemp(data.data.temporaryPassword)
      toast.success(`Created ${data.data.username}`)
      setForm({ username: '', fullName: '', email: '', role: 'teacher' })
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Create failed'
      toast.error(message)
    }
  }

  async function toggleStatus(user: AppUser) {
    const status = user.status === 'active' ? 'deactivated' : 'active'
    try {
      await api.patch(`/users/${user.id}/status`, { status })
      toast.success(`User ${status}`)
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Update failed'
      toast.error(message)
    }
  }

  async function resetPassword(user: AppUser) {
    try {
      const { data } = await api.post(`/users/${user.id}/reset-password`)
      setCreatedTemp(data.data.temporaryPassword)
      toast.success('Password reset')
    } catch {
      toast.error('Reset failed')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Users</h1>
        <p className="mt-1 text-muted-foreground">Provision staff accounts and manage access</p>
      </div>

      {createdTemp && (
        <Card className="border-primary/40 bg-accent/40">
          <CardHeader>
            <CardTitle className="text-base">Temporary password</CardTitle>
            <CardDescription>Share securely. User must change it on first login.</CardDescription>
          </CardHeader>
          <CardContent>
            <code className="rounded bg-muted px-2 py-1 text-sm">{createdTemp}</code>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create user</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createUser}>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
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
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="teacher">Teacher</option>
                <option value="staff">Staff / Supervisor</option>
                <option value="cashier">Cashier</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Create & generate password</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>{loading ? 'Loading…' : `${users.length} users`}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Username</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border/70">
                  <td className="py-3">{user.fullName}</td>
                  <td className="py-3">{user.username}</td>
                  <td className="py-3 capitalize">{user.role.replace('_', ' ')}</td>
                  <td className="py-3 capitalize">{user.status}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(user)}>
                        {user.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => resetPassword(user)}>
                        Reset password
                      </Button>
                    </div>
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
