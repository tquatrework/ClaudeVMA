import React, { createContext, useState, useCallback, useEffect, ReactNode } from 'react'
import apiClient from '../api/client'

export type UserRole =
  | 'eleve'
  | 'parent_financeur'
  | 'formateur'
  | 'animateur_pedagogique'
  | 'responsable_pedagogique'
  | 'technicien_informatique'
  | 'administrateur_financier'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  validationStatus: 'pending' | 'active' | 'suspended'
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  hasRole: (...roles: UserRole[]) => boolean
  isInternalRole: () => boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthState | null>(null)

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('user')
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser)
  const [isLoading, setIsLoading] = useState(false)

  /**
   * On mount, if a token is stored, call GET /auth/me to validate the session
   * and refresh the user data (role, validationStatus, etc.).
   * If the token is expired or invalid, the 401 interceptor clears the session.
   */
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token')
    if (!storedToken) return

    const publicPaths = ['/login', '/register', '/register/student', '/register/teacher', '/register/parent', '/password-reset', '/forbidden']
    const isPublicPath = publicPaths.some((path) => window.location.pathname.startsWith(path))
    if (isPublicPath) return

    apiClient
      .get<AuthUser>('/auth/me')
      .then(({ data }) => {
        localStorage.setItem('user', JSON.stringify(data))
        setUser(data)
      })
      .catch(() => {
        // 401 is handled by the axios interceptor which clears storage.
        // For other errors (e.g. network), keep the stored user as fallback.
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { data } = await apiClient.post<{
        access_token: string
        refresh_token: string
        user: AuthUser
      }>('/auth/login', { email, password })

      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await apiClient.get<AuthUser>('/auth/me')
      localStorage.setItem('user', JSON.stringify(data))
      setUser(data)
    } catch {
      // keep current user on network error
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // ignore network errors during logout
    } finally {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      setUser(null)
    }
  }, [])

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false
      return roles.includes(user.role)
    },
    [user],
  )

  /** Internal roles: RP, AP, TI, AdministrateurFinancier */
  const isInternalRole = useCallback(() => {
    return hasRole(
      'responsable_pedagogique',
      'animateur_pedagogique',
      'technicien_informatique',
      'administrateur_financier',
    )
  }, [hasRole])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
        hasRole,
        isInternalRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
