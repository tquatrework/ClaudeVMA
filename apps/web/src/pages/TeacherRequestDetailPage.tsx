/**
 * TeacherRequestDetailPage — `/teacher-requests/:requestId`.
 *
 * Vue commune de la demande (nom de l'élève, description, statut, professeur retenu),
 * complétée pour le RP par les étapes 3, 5 et 6 du flow : composer une proposition,
 * lire les réponses, retenir un professeur.
 *
 * Rien n'y expose d'identifiant technique. Les actions réservées au RP
 * (annuler, supprimer) ne sont **pas** affichées aux autres rôles : le serveur leur
 * répond `403`, et une entrée qui mène à un refus ne doit pas être montrée.
 */

import React, { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useSelectableTeachers } from '../hooks/teacher-requests/useSelectableTeachers'
import { useTeacherRequestDetail } from '../hooks/teacher-requests/useTeacherRequestDetail'
import TeacherProposalComposer from '../components/teacher-requests/TeacherProposalComposer'
import TeacherProposalList from '../components/teacher-requests/TeacherProposalList'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { StatusBadge } from '../components/ui/StatusBadge'
import { formatLocalDateTime, formatLongDate } from '../utils/dateFormat'
import {
  getTeacherRequestStatusColor,
  getTeacherRequestStatusLabel,
  getTeacherRequestTitle,
} from '../utils/teacherRequestLabels'

/** Statuts sur lesquels le RP peut encore agir. */
const OPEN_REQUEST_STATUSES = new Set(['pending', 'redirected'])

export default function TeacherRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { hasRole } = useAuth()
  const navigate = useNavigate()

  const isResponsablePedagogique = hasRole('responsable_pedagogique')

  const {
    request,
    proposals,
    isLoading,
    loadError,
    sendProposals,
    isSendingProposals,
    validateProposal,
    isValidating,
    changeStatus,
    isChangingStatus,
    removeRequest,
    actionError,
    clearActionError,
    successMessage,
    clearSuccessMessage,
  } = useTeacherRequestDetail(requestId, isResponsablePedagogique)

  // L'annuaire des formateurs validés est réservé aux administrateurs : on ne
  // l'appelle pas pour un rôle qui recevrait `403`.
  const {
    teachers,
    isLoading: isLoadingTeachers,
    loadError: teachersLoadError,
    isTruncated: isDirectoryTruncated,
  } = useSelectableTeachers(isResponsablePedagogique)

  const [isComposerOpen, setIsComposerOpen] = useState(false)

  const isRequestOpen = request ? OPEN_REQUEST_STATUSES.has(request.status) : false

  const handleValidate = async (proposalId: string, isPrincipalTeacher: boolean) => {
    await validateProposal({ proposalId, isPrincipalTeacher })
  }

  const handleCancel = async () => {
    if (!window.confirm('Annuler cette demande ?')) return
    await changeStatus({ status: 'cancelled' })
  }

  const handleDelete = async () => {
    if (!window.confirm('Supprimer définitivement cette demande ?')) return
    const isDeleted = await removeRequest()
    if (isDeleted) navigate('/teacher-requests')
  }

  return (
    <Layout>
      <div className="max-w-2xl space-y-5">
        <Link to="/teacher-requests" className="text-sm text-indigo-600 hover:underline">
          ← Demandes
        </Link>

        <h1 className="text-2xl font-bold text-gray-900">Détail de la demande</h1>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}
        {loadError && <ErrorMessage message={loadError} />}
        {actionError && <ErrorMessage message={actionError} onClose={clearActionError} />}
        {successMessage && (
          <ErrorMessage
            message={successMessage}
            variant="success"
            onClose={clearSuccessMessage}
          />
        )}

        {request && (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {getTeacherRequestTitle(request.studentName)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Demande créée le {formatLocalDateTime(request.createdAt)}
                  </p>
                </div>
                <StatusBadge
                  status={request.status}
                  label={getTeacherRequestStatusLabel(request.status)}
                  size="md"
                  className={getTeacherRequestStatusColor(request.status)}
                />
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Besoin exprimé</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {request.description}
                </p>
              </div>

              {request.chosenTeacherName && (
                <p className="text-sm text-green-700">
                  Professeur retenu : <strong>{request.chosenTeacherName}</strong>
                  {request.closedAt ? ` — le ${formatLongDate(request.closedAt)}` : ''}
                </p>
              )}

              {isResponsablePedagogique && isRequestOpen && (
                <div className="pt-4 flex flex-wrap gap-3 border-t border-gray-100">
                  {!isComposerOpen && (
                    <button
                      type="button"
                      onClick={() => setIsComposerOpen(true)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
                    >
                      Proposer à des professeurs
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isChangingStatus}
                    onClick={handleCancel}
                    className="text-sm text-red-500 hover:underline disabled:opacity-50"
                  >
                    Annuler la demande
                  </button>
                </div>
              )}

              {isResponsablePedagogique && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Supprimer définitivement
                  </button>
                </div>
              )}
            </div>

            {isResponsablePedagogique && isComposerOpen && (
              <TeacherProposalComposer
                requestDescription={request.description}
                teachers={teachers}
                isLoadingTeachers={isLoadingTeachers}
                teachersLoadError={teachersLoadError}
                isDirectoryTruncated={isDirectoryTruncated}
                alreadyProposedTeacherIds={proposals.map((proposal) => proposal.teacherId)}
                onSubmit={async (payload) => {
                  const isSent = await sendProposals(payload)
                  if (isSent) setIsComposerOpen(false)
                  return isSent
                }}
                isSubmitting={isSendingProposals}
                onCancel={() => setIsComposerOpen(false)}
              />
            )}

            {isResponsablePedagogique && (
              <TeacherProposalList
                proposals={proposals}
                isRequestOpen={isRequestOpen}
                onValidate={handleValidate}
                isValidating={isValidating}
              />
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
