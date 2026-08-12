/**
 * TeacherProposalList — le RP lit les réponses des professeurs (étape 5) et **tranche**
 * (étape 6) via `POST /teacher-requests/:id/validate`.
 *
 * C'est le RP qui choisit, et lui seul : le bouton « Choisir » réservé au client
 * (élève/parent) relevait du modèle abandonné, et sa route `select` n'existe plus.
 *
 * Seule une proposition **acceptée** peut être retenue — le serveur refuse les autres
 * (`400`), on ne montre donc pas le bouton ailleurs.
 */

import React, { useState } from 'react'
import type { TeacherProposal } from '../../types/teacherRequests'
import { formatLongDate } from '../../utils/dateFormat'
import {
  getTeacherDisplayName,
  getTeacherProposalStatusColor,
  getTeacherProposalStatusLabel,
} from '../../utils/teacherRequestLabels'
import { StatusBadge } from '../ui/StatusBadge'

interface TeacherProposalListProps {
  proposals: TeacherProposal[]
  /** Une demande clôturée ne se tranche plus. */
  isRequestOpen: boolean
  onValidate: (proposalId: string, isPrincipalTeacher: boolean) => void
  isValidating: boolean
}

export default function TeacherProposalList({
  proposals,
  isRequestOpen,
  onValidate,
  isValidating,
}: TeacherProposalListProps) {
  const [isPrincipalTeacher, setIsPrincipalTeacher] = useState(false)

  const acceptedProposals = proposals.filter((proposal) => proposal.status === 'accepted')

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-base font-semibold text-gray-800">
        Réponses des professeurs ({proposals.length})
      </h3>

      {proposals.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          Aucune proposition n'a encore été envoyée pour cette demande.
        </p>
      )}

      {isRequestOpen && acceptedProposals.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isPrincipalTeacher}
            onChange={(event) => setIsPrincipalTeacher(event.target.checked)}
            disabled={isValidating}
          />
          Désigner le professeur retenu comme professeur principal
        </label>
      )}

      <ul className="space-y-3">
        {proposals.map((proposal) => (
          <li
            key={proposal.id}
            className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800">
                {getTeacherDisplayName(proposal.teacherName)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Sollicité le {formatLongDate(proposal.createdAt)}
                {proposal.respondedAt
                  ? ` · a répondu le ${formatLongDate(proposal.respondedAt)}`
                  : ''}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge
                status={proposal.status}
                label={getTeacherProposalStatusLabel(proposal.status)}
                className={getTeacherProposalStatusColor(proposal.status)}
              />
              {isRequestOpen && proposal.status === 'accepted' && (
                <button
                  type="button"
                  disabled={isValidating}
                  onClick={() => onValidate(proposal.id, isPrincipalTeacher)}
                  className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isValidating ? '…' : 'Retenir ce professeur'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
