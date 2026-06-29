/**
 * DashboardPage — Point d'entrée du dashboard.
 * Redirige chaque rôle vers son dashboard dédié.
 * Fallback : EleveDashboardPage pour les rôles inconnus.
 */

import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function DashboardPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          color: '#8A90A2',
          fontSize: '14px',
        }}
      >
        Chargement…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  switch (user.role) {
    case 'eleve':
      return <Navigate to="/dashboard/eleve" replace />
    case 'parent_financeur':
      return <Navigate to="/dashboard/parent" replace />
    case 'formateur':
      return <Navigate to="/dashboard/professeur" replace />
    case 'responsable_pedagogique':
      return <Navigate to="/dashboard/rp" replace />
    case 'animateur_pedagogique':
      return <Navigate to="/dashboard/ap" replace />
    case 'administrateur_financier':
      return <Navigate to="/admin/finance" replace />
    case 'technicien_informatique':
      return <Navigate to="/admin/observability" replace />
    default:
      return <Navigate to="/dashboard/eleve" replace />
  }
}
