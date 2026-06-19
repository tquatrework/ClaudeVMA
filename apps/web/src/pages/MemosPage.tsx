/**
 * MemosPage — page principale du mémo élève.
 *
 * Règles d'accès :
 *   - Élève : CRUD complet via GET /memos, POST /memos, PUT /memos/:id, DELETE /memos/:id
 *   - Formateur lié, RP, AP : lecture seule via GET /memos/:id (pas de liste globale)
 *   - Parent financeur : accès interdit (redirection /forbidden)
 *
 * L'écran affiche les chapitres et items du mémo de l'élève connecté.
 * Pour les acteurs non-élève, un message informatif est affiché à la place
 * car GET /memos (liste) est réservé à l'élève propriétaire.
 */

import React from 'react'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import { Navigate } from 'react-router-dom'
import StudentMemoPanel from '../components/pedagogical-log/StudentMemoPanel'

export default function MemosPage() {
  const { hasRole } = useAuth()

  // Parent financeur ne doit pas voir le mémo (PLOG-FB-001)
  if (hasRole('parent_financeur')) {
    return <Navigate to="/forbidden" replace />
  }

  const isEleve = hasRole('eleve')

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mémo</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isEleve
              ? 'Vos notes personnelles structurées par chapitres'
              : 'Mémo élève — lecture seule'}
          </p>
        </div>

        {isEleve ? (
          <StudentMemoPanel />
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            <p className="font-medium mb-1">Consultation individuelle uniquement</p>
            <p>
              Le mémo appartient à l'élève. Vous pouvez consulter un mémo individuel
              via son identifiant, mais la liste globale est réservée à l'élève propriétaire.
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
