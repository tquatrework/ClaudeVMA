/**
 * TeacherProposalInbox — boîte de réception du formateur (étape 4).
 *
 * Affiche les propositions que le RP lui a adressées : le besoin de l'élève, le message
 * du RP et les trois indications facultatives (créneaux, rémunération, date limite).
 * Le formateur accepte, refuse, ou ne fait rien.
 *
 * Accepter n'affecte personne : c'est une **candidature**. Le libellé le dit, pour ne pas
 * laisser croire que le cours est acquis — c'est le RP qui tranche ensuite.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import type { TeacherProposalInboxItem } from '../../types/teacherRequests'
import { formatLongDate } from '../../utils/dateFormat'
import { formatIsoCalendarDate } from '../../utils/dateFormat'
import {
  getTeacherProposalStatusColor,
  getTeacherProposalStatusLabel,
  getTeacherRequestTitle,
} from '../../utils/teacherRequestLabels'
import { ErrorMessage } from '../ui/ErrorMessage'
import { StatusBadge } from '../ui/StatusBadge'

interface TeacherProposalInboxProps {
  proposals: TeacherProposalInboxItem[]
  isLoading: boolean
  loadError: string | null
  respondingProposalId: string | null
  respondError: string | null
  onClearRespondError: () => void
  successMessage: string | null
  onClearSuccessMessage: () => void
  onRespond: (proposalId: string, responseStatus: 'accepted' | 'declined') => void
}

/** Une proposition n'est actionnable que si elle attend encore une réponse. */
function isAwaitingResponse(proposal: TeacherProposalInboxItem): boolean {
  return proposal.status === 'pending' && proposal.requestStatus !== 'closed'
}

function ProposalDetail({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-xs text-gray-600">
      <span className="font-medium text-gray-700">{label} : </span>
      {value}
    </p>
  )
}

export default function TeacherProposalInbox({
  proposals,
  isLoading,
  loadError,
  respondingProposalId,
  respondError,
  onClearRespondError,
  successMessage,
  onClearSuccessMessage,
  onRespond,
}: TeacherProposalInboxProps) {
  if (isLoading) {
    return <p className="text-sm text-gray-400">Chargement de vos propositions…</p>
  }

  return (
    <div className="space-y-4">
      {loadError && <ErrorMessage message={loadError} />}
      {respondError && <ErrorMessage message={respondError} onClose={onClearRespondError} />}
      {successMessage && (
        <ErrorMessage
          message={successMessage}
          variant="success"
          onClose={onClearSuccessMessage}
        />
      )}

      {!loadError && proposals.length === 0 && (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-500 text-sm">
            Aucune proposition en attente de votre réponse.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {proposals.map((proposal) => {
          const isResponding = respondingProposalId === proposal.id
          const canRespond = isAwaitingResponse(proposal)

          return (
            <li
              key={proposal.id}
              className="p-4 bg-white border border-gray-200 rounded-xl space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {getTeacherRequestTitle(proposal.studentName)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Reçue le {formatLongDate(proposal.createdAt)}
                  </p>
                </div>
                <StatusBadge
                  status={proposal.status}
                  label={getTeacherProposalStatusLabel(proposal.status)}
                  className={getTeacherProposalStatusColor(proposal.status)}
                />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-700">Besoin de l'élève</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {proposal.requestDescription}
                </p>
              </div>

              {proposal.message && (
                <div>
                  <p className="text-xs font-medium text-gray-700">
                    Message du responsable pédagogique
                  </p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {proposal.message}
                  </p>
                </div>
              )}

              <div className="space-y-1">
                {proposal.availabilityNote && (
                  <ProposalDetail label="Créneaux possibles" value={proposal.availabilityNote} />
                )}
                {proposal.compensationNote && (
                  <ProposalDetail label="Rémunération" value={proposal.compensationNote} />
                )}
                {proposal.responseDeadline && (
                  <ProposalDetail
                    label="Réponse attendue avant le"
                    value={formatIsoCalendarDate(proposal.responseDeadline)}
                  />
                )}
              </div>

              {canRespond ? (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isResponding}
                    onClick={() => onRespond(proposal.id, 'accepted')}
                    className="flex-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {isResponding ? '…' : 'Me porter candidat'}
                  </button>
                  <button
                    type="button"
                    disabled={isResponding}
                    onClick={() => onRespond(proposal.id, 'declined')}
                    className="flex-1 bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-300 disabled:opacity-50 transition-colors"
                  >
                    Décliner
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-400">
                  {proposal.status === 'accepted'
                    ? 'Votre candidature est enregistrée ; le responsable pédagogique tranchera.'
                    : 'Cette proposition est close.'}
                </p>
              )}

              <Link
                to={`/teacher-requests/${proposal.requestId}`}
                className="inline-block text-xs text-indigo-600 hover:underline"
              >
                Voir la demande →
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
