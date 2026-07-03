/**
 * MemosPage — page principale du mémo élève.
 *
 * Règles d'accès (gérées par App.tsx / ProtectedRoute) :
 *   - Élève uniquement : CRUD complet via GET /memos, POST /memos, PUT /memos/:id, DELETE /memos/:id
 *   - Tout autre rôle → redirection /forbidden par ProtectedRoute
 *
 * Routes API :
 *   GET  /memos
 *   GET  /memos/search?q=
 *   POST /memos/chapters
 *   POST /memos/chapters/:chapterId/items
 */

import React from 'react'
import Layout from '../components/Layout'
import StudentMemoPanel from '../components/pedagogical-log/StudentMemoPanel'

export default function MemosPage() {
  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mémo</h1>
          <p className="text-sm text-gray-500 mt-1">
            Vos notes personnelles structurées par chapitres
          </p>
        </div>

        <StudentMemoPanel />
      </div>
    </Layout>
  )
}
