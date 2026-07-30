import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Invoice {
  id: string
  studentName?: string
  studentCode?: string
  className?: string
  month: string
  amountDue: number
  amountPaid: number
  balance: number
  status: string
  feeTagSnapshot?: string
}

interface Summary {
  billed: number
  collected: number
  outstanding: number
  clearanceRate: number
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

export function FinancePage() {
  const role = useAuthStore((s) => s.user?.role)
  const [month, setMonth] = useState(currentMonth())
  const [q, setQ] = useState('')
  const [debtorsOnly, setDebtorsOnly] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const params: Record<string, string> = { month }
      if (q) params.q = q
      if (debtorsOnly) params.debtors = 'true'
      const [inv, sum] = await Promise.all([
        api.get('/finance/invoices', { params }),
        api.get('/finance/summary', { params: { month } }),
      ])
      setInvoices(inv.data.data)
      setSummary(sum.data.data)
    } catch {
      toast.error('Failed to load finance data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [month, debtorsOnly])

  const currency = useMemo(() => '$', [])

  async function generate() {
    try {
      const { data } = await api.post('/finance/invoices/generate', { month })
      toast.success(data.message)
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Generate failed'
      toast.error(message)
    }
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    try {
      const { data } = await api.post('/finance/payments', {
        invoiceId: selected.id,
        amount: Number(payAmount),
        method,
        note,
      })
      setReceipt(data.data.payment.receiptNumber)
      toast.success(`Payment recorded · ${data.data.payment.receiptNumber}`)
      setSelected(null)
      setPayAmount('')
      setNote('')
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Payment failed'
      toast.error(message)
    }
  }

  async function waive(invoice: Invoice) {
    const reason = window.prompt('Waiver note (required)?')
    if (!reason?.trim()) return
    try {
      await api.post(`/finance/invoices/${invoice.id}/waive`, { note: reason.trim() })
      toast.success('Invoice waived')
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Waive failed'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Finance</h1>
        <p className="mt-1 text-muted-foreground">
          Monthly invoices, fee collection, and outstanding debtors
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Billed</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {summary ? `${currency}${summary.billed.toLocaleString()}` : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Collected</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {summary ? `${currency}${summary.collected.toLocaleString()}` : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-destructive">
              {summary ? `${currency}${summary.outstanding.toLocaleString()}` : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Clearance</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {summary ? `${summary.clearanceRate}%` : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {receipt && (
        <Card className="border-primary/40 bg-accent/40">
          <CardHeader>
            <CardTitle className="text-base">Last receipt</CardTitle>
            <CardDescription>Share with the payer</CardDescription>
          </CardHeader>
          <CardContent>
            <code className="rounded bg-muted px-2 py-1 text-sm">{receipt}</code>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invoices · {month}</CardTitle>
          <CardDescription>{loading ? 'Loading…' : `${invoices.length} invoices`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Search student</Label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name or ID"
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => void load()}>
              Search
            </Button>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={debtorsOnly}
                onChange={(e) => setDebtorsOnly(e.target.checked)}
              />
              Debtors only
            </label>
            {role === 'super_admin' && (
              <Button type="button" onClick={generate}>
                Generate monthly invoices
              </Button>
            )}
          </div>

          {selected && (
            <form
              onSubmit={pay}
              className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 md:grid-cols-4"
            >
              <div className="md:col-span-4 text-sm">
                Paying <strong>{selected.studentName}</strong> ({selected.studentCode}) · balance{' '}
                {currency}
                {selected.balance}
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  max={selected.balance}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile money</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Note</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="flex gap-2 md:col-span-4">
                <Button type="submit">Record payment</Button>
                <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPayAmount(String(selected.balance))}
                >
                  Pay full balance
                </Button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Student</th>
                  <th className="pb-2 font-medium">Class</th>
                  <th className="pb-2 font-medium">Due</th>
                  <th className="pb-2 font-medium">Paid</th>
                  <th className="pb-2 font-medium">Balance</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/70">
                    <td className="py-3">
                      {inv.studentName}
                      <div className="text-xs text-muted-foreground">{inv.studentCode}</div>
                    </td>
                    <td className="py-3">{inv.className || '—'}</td>
                    <td className="py-3 tabular-nums">
                      {currency}
                      {inv.amountDue}
                    </td>
                    <td className="py-3 tabular-nums">
                      {currency}
                      {inv.amountPaid}
                    </td>
                    <td className="py-3 tabular-nums">
                      {currency}
                      {inv.balance}
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs capitalize',
                          inv.status === 'paid' && 'bg-primary/15 text-primary',
                          inv.status === 'partial' &&
                            'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                          inv.status === 'unpaid' && 'bg-destructive/10 text-destructive',
                          inv.status === 'waived' && 'bg-muted'
                        )}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        {['unpaid', 'partial'].includes(inv.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelected(inv)
                              setPayAmount(String(inv.balance))
                            }}
                          >
                            Collect
                          </Button>
                        )}
                        {role === 'super_admin' && inv.status !== 'waived' && inv.status !== 'paid' && (
                          <Button size="sm" variant="ghost" onClick={() => waive(inv)}>
                            Waive
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-muted-foreground">
                      No invoices for this filter. Generate monthly invoices to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
