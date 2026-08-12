/**
 * TeacherRequestForm — le **seul** formulaire de demande de professeur (étape 1).
 *
 * Deux formulaires concurrents postaient auparavant sur `POST /teacher-requests` avec
 * deux corps différents : celui-ci (`{description}`) et `SpecificTeacherRequestForm`
 * (`{subject, level, sector, message?}`). Le second est supprimé — une route, un contrat.
 * `subject`/`level`/`sector` ne sont plus acceptés par le serveur (`400`).
 *
 * Un seul champ de saisie : `description`, texte long, requis
 * (`docs/architecture.md` > « Flow de la demande de professeur », point 2).
 */

import React, { useState } from 'react'
import type { ContactOption } from '../../hooks/relations/useMyContacts'
import type { CreateTeacherRequestPayload } from '../../types/teacherRequests'
import { ErrorMessage } from '../ui/ErrorMessage'
import StudentSelectField from './StudentSelectField'

interface TeacherRequestFormProps {
  /** Élèves rattachés — affichés seulement quand l'auteur n'est pas l'élève lui-même. */
  linkedStudents: ContactOption[]
  isLoadingStudents: boolean
  studentsError: string | null
  /** `true` pour un parent financeur : le serveur exige alors `studentId`. */
  isStudentRequired: boolean
  onSubmit: (payload: CreateTeacherRequestPayload) => Promise<boolean>
  isSubmitting: boolean
  errorMessage: string | null
  onClearError: () => void
  onCancel: () => void
}

export default function TeacherRequestForm({
  linkedStudents,
  isLoadingStudents,
  studentsError,
  isStudentRequired,
  onSubmit,
  isSubmitting,
  errorMessage,
  onClearError,
  onCancel,
}: TeacherRequestFormProps) {
  const [description, setDescription] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState(
    linkedStudents[0]?.userId ?? '',
  )

  // Le premier élève rattaché est présélectionné dès que la liste arrive.
  const effectiveStudentId =
    selectedStudentId || (linkedStudents.length === 1 ? linkedStudents[0].userId : '')

  const isDescriptionFilled = description.trim().length > 0
  const canSubmit =
    isDescriptionFilled && (!isStudentRequired || effectiveStudentId.length > 0)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return

    const payload: CreateTeacherRequestPayload = { description: description.trim() }
    if (isStudentRequired && effectiveStudentId) {
      payload.studentId = effectiveStudentId
    }

    const isCreated = await onSubmit(payload)
    if (isCreated) {
      setDescription('')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm"
    >
      <h2 className="text-base font-semibold text-gray-800">Nouvelle demande professeur</h2>

      {errorMessage && <ErrorMessage message={errorMessage} onClose={onClearError} />}

      {isStudentRequired && (
        <StudentSelectField
          students={linkedStudents}
          selectedStudentId={effectiveStudentId}
          onChange={setSelectedStudentId}
          isLoading={isLoadingStudents}
          loadError={studentsError}
          disabled={isSubmitting}
        />
      )}

      <div>
        <label
          htmlFor="teacher-request-description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description du besoin <span className="text-red-500">*</span>
        </label>
        <textarea
          id="teacher-request-description"
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Décrivez le besoin pédagogique, le niveau, les disponibilités souhaitées…"
          rows={5}
          maxLength={5000}
          disabled={isSubmitting}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-gray-400">
          Le responsable pédagogique lira cette description pour choisir les professeurs à
          solliciter.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting || !canSubmit}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Envoi…' : 'Soumettre la demande'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
