/**
 * ChangePrincipalTeacherDialog
 *
 * Permet à un élève ou parent_financeur de soumettre une demande de changement
 * de professeur principal via POST /api/v1/teacher-requests/pp-change.
 */
import React, { useState } from 'react'
import { useChangePrincipalTeacherRequest } from '../../hooks/teacher-requests/useChangePrincipalTeacherRequest'
import type { PpChangeResponse } from '../../types/teacherRequests'

interface ChangePrincipalTeacherDialogProps {
  studentId: string
  onSuccess: (newRequest: PpChangeResponse) => void
  onCancel: () => void
}

export default function ChangePrincipalTeacherDialog({
  studentId,
  onSuccess,
  onCancel,
}: ChangePrincipalTeacherDialogProps) {
  const [currentTeacherId, setCurrentTeacherId] = useState('')
  const [requestedTeacherId, setRequestedTeacherId] = useState('')
  const [reason, setReason] = useState('')

  const { isSubmitting, errorMessage, clearError, submit } =
    useChangePrincipalTeacherRequest(studentId)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const payload: { currentTeacherId?: string; requestedTeacherId?: string; reason?: string } = {}
    if (currentTeacherId.trim()) payload.currentTeacherId = currentTeacherId.trim()
    if (requestedTeacherId.trim()) payload.requestedTeacherId = requestedTeacherId.trim()
    if (reason.trim()) payload.reason = reason.trim()

    const created = await submit(payload)
    if (created) onSuccess(created)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-5">
        <h2 className="text-lg font-bold text-gray-900">
          Changer le professeur principal
        </h2>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600 ml-3"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Formateur actuel <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              value={currentTeacherId}
              onChange={(event) => setCurrentTeacherId(event.target.value)}
              placeholder="UUID du formateur actuel"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Formateur souhaité <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              value={requestedTeacherId}
              onChange={(event) => setRequestedTeacherId(event.target.value)}
              placeholder="UUID du formateur souhaité"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motif de la demande <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Expliquez la raison du changement…"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
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
