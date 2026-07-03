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

// Handle 401 — clear session and redirect to login (except on public registration/auth routes)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const publicApiRoutes = ['/accounts/teachers', '/accounts/students', '/accounts/parents', '/accounts', '/auth/login']
    const isPublicRoute = publicApiRoutes.some(
      (path) => error.config?.url?.includes(path)
    )
    if (error.response?.status === 401 && !isPublicRoute) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default apiClient
