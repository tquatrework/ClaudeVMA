/**
 * ParentFinanceurSection — Zone "Parents financeurs" pour le profil élève
 *
 * Trois sous-zones :
 *   1. Liste des parents financeurs rattachés
 *   2. Formulaire pour inviter un parent
 *   3. Accepter/refuser les invitations de parents en attente
 */

import React, { useEffect, useState, useCallback } from 'react'
import {
  fetchParentLinkRequests,
  createStudentInitiatedRequest,
  approveParentLinkRequest,
  rejectParentLinkRequest,
  type ParentLinkRequest,
} from '../../api/parentLinkRequest'
import {
  fetchLinkedParents,
  fetchStudentProfile,
  type FinanceOwnerStudentLink,
} from '../../api/relations'

interface ParentFinanceurSectionProps {
  studentId: string
}

function formatFullName(
  firstName?: string,
  lastName?: string,
  loginIdentifier?: string | null,
  fallbackId?: string,
): string {
  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(' ')
  }
  if (loginIdentifier) return loginIdentifier
  return fallbackId ? `Financeur (${fallbackId.slice(0, 8)}…)` : 'Financeur inconnu'
}

export default function ParentFinanceurSection({ studentId }: ParentFinanceurSectionProps) {
  // Sous-zone 1 — parents rattachés
  const [linkedParents, setLinkedParents] = useState<FinanceOwnerStudentLink[]>([])
  const [parentDisplayNames, setParentDisplayNames] = useState<Record<string, string>>({})
  const [isLoadingLinkedParents, setIsLoadingLinkedParents] = useState(true)
  const [linkedParentsError, setLinkedParentsError] = useState<string | null>(null)

  // Sous-zone 2 — formulaire invitation
  const [parentFirstNameInput, setParentFirstNameInput] = useState('')
  const [parentLastNameInput, setParentLastNameInput] = useState('')
  const [parentLoginIdentifierInput, setParentLoginIdentifierInput] = useState('')
  const [isSubmittingInvitation, setIsSubmittingInvitation] = useState(false)
  const [invitationSuccessMessage, setInvitationSuccessMessage] = useState<string | null>(null)
  const [invitationError, setInvitationError] = useState<string | null>(null)

  // Sous-zone 3 — demandes parent_initiated en attente
  const [pendingParentRequests, setPendingParentRequests] = useState<ParentLinkRequest[]>([])
  const [pendingParentNames, setPendingParentNames] = useState<Record<string, string>>({})
  const [isLoadingPendingRequests, setIsLoadingPendingRequests] = useState(true)
  const [pendingRequestsError, setPendingRequestsError] = useState<string | null>(null)
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<string>>(new Set())
  const [requestActionError, setRequestActionError] = useState<string | null>(null)

  const loadLinkedParents = useCallback(async () => {
    setIsLoadingLinkedParents(true)
    setLinkedParentsError(null)
    try {
      const parents = await fetchLinkedParents(studentId)
      setLinkedParents(parents)

      // Enrichissement : récupérer prénom + nom de chaque parent via GET /profiles/:id
      const displayNames: Record<string, string> = {}
      await Promise.allSettled(
        parents.map(async (link) => {
          try {
            const profile = await fetchStudentProfile(link.financeOwnerId)
            displayNames[link.financeOwnerId] = formatFullName(
              profile.administrativeProfile?.firstName,
              profile.administrativeProfile?.lastName,
              profile.loginIdentifier,
              link.financeOwnerId,
            )
          } catch {
            displayNames[link.financeOwnerId] = formatFullName(
              undefined,
              undefined,
              undefined,
              link.financeOwnerId,
            )
          }
        }),
      )
      setParentDisplayNames(displayNames)
    } catch {
      setLinkedParentsError('Impossible de charger vos parents financeurs.')
    } finally {
      setIsLoadingLinkedParents(false)
    }
  }, [studentId])

  const loadPendingParentRequests = useCallback(async () => {
    setIsLoadingPendingRequests(true)
    setPendingRequestsError(null)
    try {
      const allRequests = await fetchParentLinkRequests()
      const parentInitiatedPending = allRequests.filter(
        (request) => request.status === 'pending' && request.direction === 'parent_initiated',
      )
      setPendingParentRequests(parentInitiatedPending)

      // Enrichissement : récupérer prénom + nom de chaque parent demandeur
      const names: Record<string, string> = {}
      await Promise.allSettled(
        parentInitiatedPending.map(async (request) => {
          try {
            const profile = await fetchStudentProfile(request.parentId)
            names[request.parentId] = formatFullName(
              profile.administrativeProfile?.firstName,
              profile.administrativeProfile?.lastName,
              profile.loginIdentifier,
              request.parentId,
            )
          } catch {
            names[request.parentId] = formatFullName(
              undefined,
              undefined,
              undefined,
              request.parentId,
            )
          }
        }),
      )
      setPendingParentNames(names)
    } catch {
      setPendingRequestsError('Impossible de charger les invitations en attente.')
    } finally {
      setIsLoadingPendingRequests(false)
    }
  }, [])

  useEffect(() => {
    loadLinkedParents()
    loadPendingParentRequests()
  }, [loadLinkedParents, loadPendingParentRequests])

  const handleSendInvitation = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedIdentifier = parentLoginIdentifierInput.trim()
    if (!trimmedIdentifier) return

    setIsSubmittingInvitation(true)
    setInvitationError(null)
    setInvitationSuccessMessage(null)

    try {
      await createStudentInitiatedRequest(trimmedIdentifier)
      setInvitationSuccessMessage(
        'Invitation envoyée. Votre parent financeur recevra une notification pour accepter.',
      )
      setParentFirstNameInput('')
      setParentLastNameInput('')
      setParentLoginIdentifierInput('')
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { message?: string } } }
      if (axiosError.response?.status === 409) {
        setInvitationError('Une demande est déjà en cours pour ce parent.')
      } else if (axiosError.response?.status === 404) {
        setInvitationError('Identifiant parent introuvable. Vérifiez l\'identifiant communiqué.')
      } else {
        setInvitationError(
          axiosError.response?.data?.message ?? 'Une erreur est survenue. Veuillez réessayer.',
        )
      }
    } finally {
      setIsSubmittingInvitation(false)
    }
  }

  const handleApproveRequest = async (requestId: string) => {
    setProcessingRequestIds((previous) => new Set(previous).add(requestId))
    setRequestActionError(null)
    try {
      await approveParentLinkRequest(requestId)
      await Promise.all([loadLinkedParents(), loadPendingParentRequests()])
    } catch {
      setRequestActionError('Impossible d\'approuver la demande. Veuillez réessayer.')
    } finally {
      setProcessingRequestIds((previous) => {
        const updated = new Set(previous)
        updated.delete(requestId)
        return updated
      })
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    setProcessingRequestIds((previous) => new Set(previous).add(requestId))
    setRequestActionError(null)
    try {
      await rejectParentLinkRequest(requestId)
      await loadPendingParentRequests()
    } catch {
      setRequestActionError('Impossible de refuser la demande. Veuillez réessayer.')
    } finally {
      setProcessingRequestIds((previous) => {
        const updated = new Set(previous)
        updated.delete(requestId)
        return updated
      })
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Parents financeurs</h2>

      {/* Sous-zone 1 — Parents rattachés */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-3">Vos parents financeurs</h3>
        {isLoadingLinkedParents ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : linkedParentsError ? (
          <p className="text-sm text-red-600">{linkedParentsError}</p>
        ) : linkedParents.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun parent financeur rattaché pour l'instant.</p>
        ) : (
          <ul className="space-y-2">
            {linkedParents.map((link) => (
              <li
                key={link.financeOwnerId}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-sm text-gray-800 font-medium">
                  {parentDisplayNames[link.financeOwnerId] ?? formatFullName(undefined, undefined, undefined, link.financeOwnerId)}
                </span>
                <span className="text-xs text-gray-400">
                  Depuis le{' '}
                  {new Date(link.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sous-zone 2 — Déclarer un parent financeur */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-1">Déclarer un parent financeur</h3>
        <p className="text-xs text-gray-500 mb-4">
          Invitez votre parent financeur à se rattacher à votre compte.
        </p>

        <form onSubmit={handleSendInvitation} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="parentFirstName" className="block text-xs font-medium text-gray-600 mb-1">
                Prénom (indicatif)
              </label>
              <input
                id="parentFirstName"
                type="text"
                value={parentFirstNameInput}
                onChange={(e) => setParentFirstNameInput(e.target.value)}
                placeholder="ex : Marie"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                disabled={isSubmittingInvitation}
              />
            </div>
            <div>
              <label htmlFor="parentLastName" className="block text-xs font-medium text-gray-600 mb-1">
                Nom (indicatif)
              </label>
              <input
                id="parentLastName"
                type="text"
                value={parentLastNameInput}
                onChange={(e) => setParentLastNameInput(e.target.value)}
                placeholder="ex : Dupont"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                disabled={isSubmittingInvitation}
              />
            </div>
          </div>

          <div>
            <label htmlFor="parentLoginIdentifier" className="block text-xs font-medium text-gray-600 mb-1">
              Identifiant du parent <span className="text-red-500">*</span>
            </label>
            <input
              id="parentLoginIdentifier"
              type="text"
              required
              value={parentLoginIdentifierInput}
              onChange={(e) => setParentLoginIdentifierInput(e.target.value)}
              placeholder="ex : marie.dupont"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              disabled={isSubmittingInvitation}
            />
            <p className="text-xs text-gray-400 mt-1">
              Identifiant de connexion communiqué par votre parent.
            </p>
          </div>

          {invitationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {invitationError}
            </div>
          )}

          {invitationSuccessMessage && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {invitationSuccessMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmittingInvitation || !parentLoginIdentifierInput.trim()}
            className="bg-indigo-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmittingInvitation ? 'Envoi…' : 'Envoyer une invitation'}
          </button>
        </form>
      </div>

      {/* Sous-zone 3 — Invitations de parents en attente */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-3">
          Accepter l'invitation d'un parent financeur
        </h3>

        {requestActionError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {requestActionError}
          </div>
        )}

        {isLoadingPendingRequests ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : pendingRequestsError ? (
          <p className="text-sm text-red-600">{pendingRequestsError}</p>
        ) : pendingParentRequests.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune invitation en attente.</p>
        ) : (
          <ul className="space-y-3">
            {pendingParentRequests.map((request) => {
              const isProcessing = processingRequestIds.has(request.id)
              return (
                <li
                  key={request.id}
                  className="p-4 bg-gray-50 border border-gray-200 rounded-xl"
                >
                  <p className="text-sm font-medium text-gray-800 mb-1">
                    {pendingParentNames[request.parentId] ?? 'Chargement…'} souhaite vous rattacher
                  </p>
                  <p className="text-xs text-gray-500 mb-1">
                    Demande de rattachement parent financeur
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    Reçue le{' '}
                    {new Date(request.requestedAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveRequest(request.id)}
                      disabled={isProcessing}
                      className="bg-green-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => handleRejectRequest(request.id)}
                      disabled={isProcessing}
                      className="bg-red-100 text-red-700 text-sm px-4 py-1.5 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors border border-red-200"
                    >
                      Refuser
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
