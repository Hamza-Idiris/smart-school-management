import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshing: Promise<string | null> | null = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }
    if (original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh')) {
      return Promise.reject(error)
    }

    original._retry = true
    try {
      if (!refreshing) {
        refreshing = api
          .post('/auth/refresh')
          .then((res) => {
            const { accessToken, user } = res.data.data
            useAuthStore.getState().setAuth(user, accessToken)
            return accessToken as string
          })
          .catch(() => {
            useAuthStore.getState().clearAuth()
            return null
          })
          .finally(() => {
            refreshing = null
          })
      }
      const token = await refreshing
      if (!token) return Promise.reject(error)
      original.headers.Authorization = `Bearer ${token}`
      return api(original)
    } catch {
      return Promise.reject(error)
    }
  }
)
