import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'

export async function downloadReport(path: string, params: Record<string, string>, filenameHint: string) {
  const res = await api.get(path, {
    params,
    responseType: 'blob',
  })
  const format = (params.format || 'csv').toLowerCase()
  const mime =
    format === 'pdf'
      ? 'application/pdf'
      : format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv'
  const disposition = res.headers['content-disposition'] as string | undefined
  let filename = `${filenameHint}.${format}`
  const match = disposition?.match(/filename="?([^"]+)"?/)
  if (match?.[1]) filename = match[1]

  const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.URL.revokeObjectURL(url)
}

export function useAccessToken() {
  return useAuthStore((s) => s.accessToken)
}
