/**
 * TeacherProposalComposer — le RP compose une proposition et l'adresse à **plusieurs**
 * formateurs d'un coup (étape 3). `POST /teacher-requests/:requestId/proposals` est un
 * envoi groupé et atomique.
 *
 * Le message est pré-rempli depuis la description de la demande — côté front uniquement :
 * `description` (rédigée par l'élève) et `message` (rédigé par le RP) sont deux données
 * distinctes, portées par deux entités différentes.
 *
 * Aucun UUID n'est saisi : la sélection se fait par cases à cocher sur des noms. Tant
 * qu'aucune route d'annuaire n'existe côté serveur, le composeur le dit et n'offre pas de
 * champ de repli — voir `hooks/teacher-requests/useSelectableTeachers.ts`.
 */

import React, { useState } from 'react'
import type { SelectableTeacher } from '../../hooks/teacher-requests/useSelectableTeachers'
import type { SendTeacherProposalsPayload } from '../../types/teacherRequests'
import { ErrorMessage } from '../ui/ErrorMessage'

interface TeacherProposalComposerProps {
  /** Description rédigée par l'élève, proposée comme point de départ du message. */
  requestDescription: string
  teachers: SelectableTeacher[]
  isLoadingTeachers: boolean
  isDirectoryUnavailable: boolean
  /** Formateurs déjà sollicités sur cette demande — le serveur refuse un doublon. */
  alreadyProposedTeacherIds: string[]
  onSubmit: (payload: SendTeacherProposalsPayload) => Promise<boolean>
  isSubmitting: boolean
  onCancel: () => void
}

export default function TeacherProposalComposer({
  requestDescription,
  teachers,
  isLoadingTeachers,
  isDirectoryUnavailable,
  alreadyProposedTeacherIds,
  onSubmit,
  isSubmitting,
  onCancel,
}: TeacherProposalComposerProps) {
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([])
  const [message, setMessage] = useState(requestDescription)
  const [availabilityNote, setAvailabilityNote] = useState('')
  const [compensationNote, setCompensationNote] = useState('')
  const [responseDeadline, setResponseDeadline] = useState('')

  const selectableTeachers = teachers.filter(
    (teacher) => !alreadyProposedTeacherIds.includes(teacher.userId),
  )

  const toggleTeacher = (teacherId: string) => {
    setSelectedTeacherIds((previous) =>
      previous.includes(teacherId)
        ? previous.filter((selectedId) => selectedId !== teacherId)
        : [...previous, teacherId],
    )
  }

  const canSubmit = selectedTeacherIds.length > 0 && message.trim().length > 0

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return

    const payload: SendTeacherProposalsPayload = {
      teacherIds: selectedTeacherIds,
      message: message.trim(),
    }
    if (availabilityNote.trim()) payload.availabilityNote = availabilityNote.trim()
    if (compensationNote.trim()) payload.compensationNote = compensationNote.trim()
    if (responseDeadline) payload.responseDeadline = responseDeadline

    const isSent = await onSubmit(payload)
    if (isSent) {
      setSelectedTeacherIds([])
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-xl p-5 space-y-5"
    >
      <h3 className="text-base font-semibold text-gray-800">
        Proposer cette demande à des professeurs
      </h3>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700 mb-1">
          Professeurs sollicités <span className="text-red-500">*</span>
        </legend>

        {isLoadingTeachers && (
          <p className="text-sm text-gray-400">Chargement des professeurs…</p>
        )}

        {!isLoadingTeachers && isDirectoryUnavailable && (
          <ErrorMessage
            variant="warning"
            message="La liste des professeurs n'est pas encore disponible : cette étape sera activée dès que l'annuaire des professeurs sera en ligne."
          />
        )}

        {!isLoadingTeachers && !isDirectoryUnavailable && selectableTeachers.length === 0 && (
          <p className="text-sm text-gray-500">
            Tous les professeurs disponibles ont déjà été sollicités sur cette demande.
          </p>
        )}

        {selectableTeachers.map((teacher) => (
          <label
            key={teacher.userId}
            className="flex items-center gap-2 text-sm text-gray-700"
          >
            <input
              type="checkbox"
              checked={selectedTeacherIds.includes(teacher.userId)}
              onChange={() => toggleTeacher(teacher.userId)}
              disabled={isSubmitting}
            />
            {teacher.displayName}
          </label>
        ))}
      </fieldset>

      <div>
        <label
          htmlFor="proposal-message"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Message aux professeurs <span className="text-red-500">*</span>
        </label>
        <textarea
          id="proposal-message"
          required
          rows={4}
          maxLength={5000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={isSubmitting}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-gray-400">
          Pré-rempli avec la description de l'élève : adaptez-le librement.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="proposal-availability"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Créneaux possibles <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <input
            id="proposal-availability"
            type="text"
            value={availabilityNote}
            onChange={(event) => setAvailabilityNote(event.target.value)}
            placeholder="ex. mardi ou jeudi après 17h"
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="proposal-compensation"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Rémunération <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <input
            id="proposal-compensation"
            type="text"
            value={compensationNote}
            onChange={(event) => setCompensationNote(event.target.value)}
            placeholder="ex. 45 € de l'heure"
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="proposal-deadline"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Date limite de réponse{' '}
            <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <input
            id="proposal-deadline"
            type="date"
            value={responseDeadline}
            onChange={(event) => setResponseDeadline(event.target.value)}
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting || !canSubmit}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Envoi…' : 'Envoyer la proposition'}
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
