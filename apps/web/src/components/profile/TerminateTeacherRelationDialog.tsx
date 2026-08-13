/**
 * TerminateTeacherRelationDialog — confirmation avant de mettre fin à une relation
 * élève ↔ formateur, depuis la fiche de l'élève (arbitrage du 2026-08-12, « Fin d'une
 * relation élève↔formateur »). Réservée au RP : c'est le seul rôle à qui `ProfilePage`
 * propose ce bouton.
 *
 * Même parti pris que `UnlinkFinanceRelationDialog` : la boîte **nomme la personne**
 * (prénom + nom, jamais un UUID) et dit en une phrase ce que « Mettre fin » veut dire —
 * la relation n'est pas supprimée, elle est journalée comme terminée, et elle peut être
 * recréée ensuite par le flow normal de demande de professeur. Le motif est **optionnel**
 * : le déclencheur est hors logiciel (appel, courriel…), le RP n'a pas toujours de texte
 * à consigner.
 *
 * En cas d'échec, la boîte **reste ouverte** et affiche le message : l'utilisateur voit
 * le refus au lieu de croire la relation terminée.
 */

import React from 'react'
import { TERMINATE_TEACHER_RELATION_ACTION_LABEL } from '../../utils/relationLabels'

interface TerminateTeacherRelationDialogProps {
  /** Prénom + nom du formateur, déjà résolu — jamais un identifiant technique. */
  teacherName: string
  reason: string
  onReasonChange: (reason: string) => void
  reasonMaxLength: number
  isSubmitting: boolean
  errorMessage: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function TerminateTeacherRelationDialog({
  teacherName,
  reason,
  onReasonChange,
  reasonMaxLength,
  isSubmitting,
  errorMessage,
  onConfirm,
  onCancel,
}: TerminateTeacherRelationDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terminate-teacher-relation-title"
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
        <h2 id="terminate-teacher-relation-title" className="text-lg font-semibold text-gray-900">
          Mettre fin à la relation avec {teacherName} ?
        </h2>

        <p className="text-sm text-gray-600">
          {teacherName} n'aura plus accès au profil, aux statistiques ni aux archives
          pédagogiques de cet élève. La relation n'est pas supprimée : elle est
          enregistrée comme terminée, à la date du jour, et pourra être recréée plus
          tard par une nouvelle demande de professeur.
        </p>

        {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}

        <div>
          <label
            htmlFor="terminate-teacher-relation-reason"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Motif (optionnel)
          </label>
          <textarea
            id="terminate-teacher-relation-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={3}
            maxLength={reasonMaxLength}
            placeholder="Ex. : formateur indisponible, changement demandé par la famille…"
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Fin de la relation…' : TERMINATE_TEACHER_RELATION_ACTION_LABEL}
          </button>
        </div>
      </div>
    </div>
  )
}
