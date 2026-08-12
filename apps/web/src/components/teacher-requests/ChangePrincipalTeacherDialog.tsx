/**
 * ChangePrincipalTeacherDialog — demande de changement de professeur principal
 * (`POST /teacher-requests/pp-change`, parent financeur uniquement).
 *
 * Corps aligné sur `POST /teacher-requests` : `{studentId, currentPpTeacherId?, description}`.
 * Le front envoyait `{currentTeacherId, requestedTeacherId, reason}` — trois noms
 * qu'aucun DTO ne déclare, saisis sous forme d'UUID dans deux champs texte.
 *
 * Élève et professeur se choisissent par leur nom, dans les contacts déjà chargés par la
 * page : le parent est relié à ses élèves et, indirectement, à leurs professeurs.
 */

import React, { useState } from 'react'
import { useChangePrincipalTeacherRequest } from '../../hooks/teacher-requests/useChangePrincipalTeacherRequest'
import type { ContactOption } from '../../hooks/relations/useMyContacts'
import { selectTeachersOfStudent } from '../../utils/contactSelectors'
import { ErrorMessage } from '../ui/ErrorMessage'

interface ChangePrincipalTeacherDialogProps {
  /** Élèves financés par l'utilisateur — au moins un, sinon le bouton n'est pas affiché. */
  linkedStudents: ContactOption[]
  /** Tous les contacts, pour en dériver les professeurs de l'élève choisi. */
  allContacts: ContactOption[]
  onSuccess: () => void
  onCancel: () => void
}

export default function ChangePrincipalTeacherDialog({
  linkedStudents,
  allContacts,
  onSuccess,
  onCancel,
}: ChangePrincipalTeacherDialogProps) {
  const [studentId, setStudentId] = useState(linkedStudents[0]?.userId ?? '')
  const [currentPpTeacherId, setCurrentPpTeacherId] = useState('')
  const [description, setDescription] = useState('')

  const { isSubmitting, errorMessage, clearError, submit } = useChangePrincipalTeacherRequest()

  const teachersOfStudent = selectTeachersOfStudent(allContacts, studentId)
  const canSubmit = studentId.length > 0 && description.trim().length > 0

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return

    const isCreated = await submit({
      studentId,
      description: description.trim(),
      ...(currentPpTeacherId ? { currentPpTeacherId } : {}),
    })
    if (isCreated) onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-5">
        <h2 className="text-lg font-bold text-gray-900">Changer le professeur principal</h2>

        {errorMessage && <ErrorMessage message={errorMessage} onClose={clearError} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="pp-change-student"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Élève concerné <span className="text-red-500">*</span>
            </label>
            <select
              id="pp-change-student"
              required
              value={studentId}
              onChange={(event) => {
                setStudentId(event.target.value)
                setCurrentPpTeacherId('')
              }}
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
            >
              {linkedStudents.map((student) => (
                <option key={student.userId} value={student.userId}>
                  {student.displayName}
                </option>
              ))}
            </select>
          </div>

          {teachersOfStudent.length > 0 && (
            <div>
              <label
                htmlFor="pp-change-current-teacher"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Professeur principal actuel{' '}
                <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <select
                id="pp-change-current-teacher"
                value={currentPpTeacherId}
                onChange={(event) => setCurrentPpTeacherId(event.target.value)}
                disabled={isSubmitting}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
              >
                <option value="">Je ne précise pas</option>
                {teachersOfStudent.map((teacher) => (
                  <option key={teacher.userId} value={teacher.userId}>
                    {teacher.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="pp-change-description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Motif de la demande <span className="text-red-500">*</span>
            </label>
            <textarea
              id="pp-change-description"
              required
              rows={4}
              maxLength={5000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Expliquez la raison du changement souhaité…"
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none disabled:opacity-50"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Envoi…' : 'Soumettre la demande'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
