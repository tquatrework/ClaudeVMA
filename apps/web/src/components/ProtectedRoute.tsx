import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** If provided, only users with one of these roles can access the route. */
  allowedRoles?: UserRole[]
}

/**
 * Wraps a route requiring authentication.
 * - Unauthenticated → redirect to /login (preserves intended destination)
 * - Authenticated but wrong role → redirect to /forbidden
 *
 * Note: frontend role-gating is ergonomic only. The backend enforces access.
 */
export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, hasRole } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(...allowedRoles)) {
    return <Navigate to="/forbidden" replace />
  }

  return <>{children}</>
}
