/**
 * StudentSelectField — choix d'un élève par son **prénom et son nom**.
 *
 * Remplace l'`<input type="text" placeholder="UUID de l'élève concerné">` qui existait
 * dans les deux formulaires de demande : aucun UUID n'est lu ni saisi par un utilisateur
 * (arbitrage du 2026-08-09). Les options viennent de `GET /relations/my-contacts`, chargé
 * une seule fois au niveau de la page.
 */

import React from 'react'
import type { ContactOption } from '../../hooks/relations/useMyContacts'

interface StudentSelectFieldProps {
  students: ContactOption[]
  selectedStudentId: string
  onChange: (studentId: string) => void
  isLoading: boolean
  loadError: string | null
  disabled?: boolean
}

export default function StudentSelectField({
  students,
  selectedStudentId,
  onChange,
  isLoading,
  loadError,
  disabled = false,
}: StudentSelectFieldProps) {
  if (isLoading) {
    return <p className="text-sm text-gray-400">Chargement de vos élèves…</p>
  }

  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>
  }

  if (students.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Aucun élève n'est rattaché à votre compte. Rattachez d'abord un élève pour pouvoir
        demander un professeur.
      </p>
    )
  }

  return (
    <div>
      <label
        htmlFor="teacher-request-student"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        Élève concerné <span className="text-red-500">*</span>
      </label>
      <select
        id="teacher-request-student"
        required
        value={selectedStudentId}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
      >
        {students.map((student) => (
          <option key={student.userId} value={student.userId}>
            {student.displayName}
          </option>
        ))}
      </select>
    </div>
  )
}
