/**
 * MemosPage — page principale du mémo élève.
 *
 * Règles d'accès (gérées par App.tsx / ProtectedRoute) :
 *   - Élève uniquement : CRUD des chapitres et items via `StudentMemoPanel`
 *     (`docs/routes.md` § « Mémo élève — assaini le 2026-08-27 »).
 *   - Tout autre rôle → redirection /forbidden par ProtectedRoute.
 *
 * La lecture par un tiers relié (formateur, RP/AP, parent) ne passe pas par
 * cette page : voir `MemoReadOnlyModal`, ouverte depuis `/my-students`.
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
