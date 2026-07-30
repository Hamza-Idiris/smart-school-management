import { Fragment, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { downloadReport } from '@/lib/download'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AuditItem {
  id: string
  at: string
  actorName?: string
  actorUsername?: string
  actorRole?: string
  action: string
  entity: string
  entityId?: string
  ip?: string
  before?: unknown
  after?: unknown
}

export function AuditPage() {
  const [items, setItems] = useState<AuditItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [entity, setEntity] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const limit = 25

  async function load(nextPage = page) {
    try {
      const { data } = await api.get('/audit-logs', {
        params: {
          page: nextPage,
          limit,
          ...(action ? { action } : {}),
          ...(entity ? { entity } : {}),
        },
      })
      setItems(data.data.items)
      setTotal(data.data.total)
      setPage(data.data.page)
    } catch {
      toast.error('Failed to load audit logs')
    }
  }

  useEffect(() => {
    void load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function exportLogs(format: 'csv' | 'pdf') {
    try {
      await downloadReport(
        '/reports/audit',
        {
          format,
          ...(action ? { action } : {}),
          ...(entity ? { entity } : {}),
        },
        'audit-logs'
      )
      toast.success(`${format.toUpperCase()} downloaded`)
    } catch {
      toast.error('Export failed')
    }
  }

  const pages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Audit logs</h1>
          <p className="mt-1 text-muted-foreground">
            Immutable trail for auth, attendance overrides, grades, and finance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportLogs('csv')}>
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportLogs('pdf')}>
            Export PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>{total} matching events</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              void load(1)
            }}
          >
            <div className="space-y-2">
              <Label>Action contains</Label>
              <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="login" />
            </div>
            <div className="space-y-2">
              <Label>Entity</Label>
              <Input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="Invoice" />
            </div>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">When</th>
                <th className="pb-2 font-medium">Actor</th>
                <th className="pb-2 font-medium">Action</th>
                <th className="pb-2 font-medium">Entity</th>
                <th className="pb-2 font-medium">IP</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <Fragment key={item.id}>
                  <tr className="border-b border-border/70">
                    <td className="py-3 whitespace-nowrap">
                      {item.at ? new Date(item.at).toLocaleString() : '—'}
                    </td>
                    <td className="py-3">
                      {item.actorName || '—'}
                      <div className="text-xs text-muted-foreground">
                        {item.actorUsername} · {item.actorRole}
                      </div>
                    </td>
                    <td className="py-3 font-medium">{item.action}</td>
                    <td className="py-3">
                      {item.entity}
                      {item.entityId ? (
                        <div className="max-w-[160px] truncate text-xs text-muted-foreground">
                          {item.entityId}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 text-xs">{item.ip || '—'}</td>
                    <td className="py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                      >
                        {expanded === item.id ? 'Hide' : 'Details'}
                      </Button>
                    </td>
                  </tr>
                  {expanded === item.id && (
                    <tr className="border-b border-border/70 bg-muted/20">
                      <td colSpan={6} className="px-3 py-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <pre className="overflow-x-auto rounded-md bg-card p-3 text-xs">
                            {JSON.stringify(item.before ?? null, null, 2)}
                          </pre>
                          <pre className="overflow-x-auto rounded-md bg-card p-3 text-xs">
                            {JSON.stringify(item.after ?? null, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-muted-foreground">
                    No audit events yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {pages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => void load(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => void load(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
