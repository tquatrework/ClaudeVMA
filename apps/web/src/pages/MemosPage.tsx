/**
 * MemosPage — page principale du mémo élève.
 * Affiche les chapitres et items du mémo. Création réservée à l'élève.
 * Les formateurs voient le mémo en readonly (le backend renvoie 403 à l'écriture).
 *
 * Routes API :
 *   GET  /memos
 *   GET  /memos/search?q=
 *   POST /memos/chapters
 *   POST /memos/chapters/:chapterId/items
 */

import React from 'react'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import { Navigate } from 'react-router-dom'
import StudentMemoPanel from '../components/pedagogical-log/StudentMemoPanel'

export default function MemosPage() {
  const { hasRole } = useAuth()

  // Parent financeur ne doit pas voir le mémo (mesure de sécurité ergonomique)
  if (hasRole('parent_financeur')) {
    return <Navigate to="/forbidden" replace />
  }

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mémo</h1>
          <p className="text-sm text-gray-500 mt-1">
            {hasRole('eleve')
              ? 'Vos notes personnelles structurées par chapitres'
              : 'Mémo de l\'élève — consultation uniquement'}
          </p>
        </div>

        <StudentMemoPanel />
      </div>
    </Layout>
  )
}
