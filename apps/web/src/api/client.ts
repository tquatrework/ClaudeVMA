/// <reference types="vite/client" />
import axios from 'axios'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach JWT on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 — clear session and redirect to login ONLY when the main auth
// token itself is rejected (i.e. /auth/me or /auth/refresh).
// A 401 returned by any other service route (e.g. /orchestration/workflows)
// means the user lacks permission for that specific resource — it must NOT
// log the user out. Each call site's own .catch() handles those errors locally.
const AUTH_ROUTES_REQUIRING_LOGOUT = ['/auth/me', '/auth/refresh']

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl: string = error.config?.url ?? ''
    const isAuthTokenRejected = AUTH_ROUTES_REQUIRING_LOGOUT.some((authPath) =>
      requestUrl.includes(authPath)
    )
    if (error.response?.status === 401 && isAuthTokenRejected) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default apiClient
