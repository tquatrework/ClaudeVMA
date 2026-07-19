/**
 * LinkedStudentsSection — Zone "Mes élèves / enfants" pour le profil parent_financeur
 *
 * Trois sous-zones :
 *   1. Liste des élèves rattachés
 *   2. Formulaire pour déclarer un élève (invitation parent_initiated)
 *   3. Accepter/refuser les demandes student_initiated en attente
 */

import React, { useEffect, useState, useCallback } from 'react'
import {
  fetchParentLinkRequests,
  createParentLinkRequest,
  approveParentLinkRequest,
  rejectParentLinkRequest,
  type ParentLinkRequest,
} from '../../api/parentLinkRequest'
import {
  fetchLinkedStudents,
  fetchStudentProfile,
  type FinanceOwnerStudentLink,
} from '../../api/relations'

interface LinkedStudentsSectionProps {
  parentId: string
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
  return fallbackId ? `Élève (${fallbackId.slice(0, 8)}…)` : 'Élève inconnu'
}

export default function LinkedStudentsSection({ parentId }: LinkedStudentsSectionProps) {
  // Sous-zone 1 — élèves rattachés
  const [linkedStudents, setLinkedStudents] = useState<FinanceOwnerStudentLink[]>([])
  const [studentDisplayNames, setStudentDisplayNames] = useState<Record<string, string>>({})
  const [isLoadingLinkedStudents, setIsLoadingLinkedStudents] = useState(true)
  const [linkedStudentsError, setLinkedStudentsError] = useState<string | null>(null)

  // Sous-zone 2 — formulaire invitation
  const [studentFirstNameInput, setStudentFirstNameInput] = useState('')
  const [studentLastNameInput, setStudentLastNameInput] = useState('')
  const [studentLoginIdentifierInput, setStudentLoginIdentifierInput] = useState('')
  const [isSubmittingInvitation, setIsSubmittingInvitation] = useState(false)
  const [invitationSuccessMessage, setInvitationSuccessMessage] = useState<string | null>(null)
  const [invitationError, setInvitationError] = useState<string | null>(null)

  // Sous-zone 3 — demandes student_initiated en attente
  const [pendingStudentRequests, setPendingStudentRequests] = useState<ParentLinkRequest[]>([])
  const [pendingStudentNames, setPendingStudentNames] = useState<Record<string, string>>({})
  const [isLoadingPendingRequests, setIsLoadingPendingRequests] = useState(true)
  const [pendingRequestsError, setPendingRequestsError] = useState<string | null>(null)
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<string>>(new Set())
  const [requestActionError, setRequestActionError] = useState<string | null>(null)

  const loadLinkedStudents = useCallback(async () => {
    setIsLoadingLinkedStudents(true)
    setLinkedStudentsError(null)
    try {
      const students = await fetchLinkedStudents(parentId)
      setLinkedStudents(students)

      // Enrichissement : récupérer prénom + nom de chaque élève via GET /profiles/:id
      const displayNames: Record<string, string> = {}
      await Promise.allSettled(
        students.map(async (link) => {
          try {
            const profile = await fetchStudentProfile(link.studentId)
            displayNames[link.studentId] = formatFullName(
              profile.administrativeProfile?.firstName,
              profile.administrativeProfile?.lastName,
              profile.loginIdentifier,
              link.studentId,
            )
          } catch {
            displayNames[link.studentId] = formatFullName(
              undefined,
              undefined,
              undefined,
              link.studentId,
            )
          }
        }),
      )
      setStudentDisplayNames(displayNames)
    } catch {
      setLinkedStudentsError('Impossible de charger vos élèves rattachés.')
    } finally {
      setIsLoadingLinkedStudents(false)
    }
  }, [parentId])

  const loadPendingStudentRequests = useCallback(async () => {
    setIsLoadingPendingRequests(true)
    setPendingRequestsError(null)
    try {
      const allRequests = await fetchParentLinkRequests()
      const studentInitiatedPending = allRequests.filter(
        (request) => request.status === 'pending' && request.direction === 'student_initiated',
      )
      setPendingStudentRequests(studentInitiatedPending)

      // Enrichissement : récupérer prénom + nom de chaque élève demandeur
      const names: Record<string, string> = {}
      await Promise.allSettled(
        studentInitiatedPending.map(async (request) => {
          try {
            const profile = await fetchStudentProfile(request.studentId)
            names[request.studentId] = formatFullName(
              profile.administrativeProfile?.firstName,
              profile.administrativeProfile?.lastName,
              profile.loginIdentifier,
              request.studentId,
            )
          } catch {
            names[request.studentId] = formatFullName(
              undefined,
              undefined,
              undefined,
              request.studentId,
            )
          }
        }),
      )
      setPendingStudentNames(names)
    } catch {
      setPendingRequestsError('Impossible de charger les demandes en attente.')
    } finally {
      setIsLoadingPendingRequests(false)
    }
  }, [])

  useEffect(() => {
    loadLinkedStudents()
    loadPendingStudentRequests()
  }, [loadLinkedStudents, loadPendingStudentRequests])

  const handleSendInvitation = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedIdentifier = studentLoginIdentifierInput.trim()
    if (!trimmedIdentifier) return

    setIsSubmittingInvitation(true)
    setInvitationError(null)
    setInvitationSuccessMessage(null)

    try {
      await createParentLinkRequest(trimmedIdentifier)
      setInvitationSuccessMessage(
        "Invitation envoyée. L'élève recevra une notification pour accepter.",
      )
      setStudentFirstNameInput('')
      setStudentLastNameInput('')
      setStudentLoginIdentifierInput('')
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { message?: string } } }
      if (axiosError.response?.status === 409) {
        setInvitationError('Une demande est déjà en cours pour cet élève.')
      } else if (axiosError.response?.status === 404) {
        setInvitationError("Identifiant élève introuvable. Vérifiez l'identifiant communiqué.")
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
      await Promise.all([loadLinkedStudents(), loadPendingStudentRequests()])
    } catch {
      setRequestActionError("Impossible d'approuver la demande. Veuillez réessayer.")
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
      await loadPendingStudentRequests()
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
      <h2 className="text-lg font-semibold text-gray-900">Mes élèves / enfants</h2>

      {/* Sous-zone 1 — Élèves rattachés */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-3">Vos élèves rattachés</h3>
        {isLoadingLinkedStudents ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : linkedStudentsError ? (
          <p className="text-sm text-red-600">{linkedStudentsError}</p>
        ) : linkedStudents.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun élève rattaché pour l'instant.</p>
        ) : (
          <ul className="space-y-2">
            {linkedStudents.map((link) => (
              <li
                key={link.studentId}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-sm text-gray-800 font-medium">
                  {studentDisplayNames[link.studentId] ?? formatFullName(undefined, undefined, undefined, link.studentId)}
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

      {/* Sous-zone 2 — Déclarer un élève */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-1">Déclarer un élève</h3>
        <p className="text-xs text-gray-500 mb-4">
          Envoyez une demande de rattachement à un élève. Celui-ci devra l'approuver.
        </p>

        <form onSubmit={handleSendInvitation} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="studentFirstName" className="block text-xs font-medium text-gray-600 mb-1">
                Prénom (indicatif)
              </label>
              <input
                id="studentFirstName"
                type="text"
                value={studentFirstNameInput}
                onChange={(e) => setStudentFirstNameInput(e.target.value)}
                placeholder="ex : Lucas"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                disabled={isSubmittingInvitation}
              />
            </div>
            <div>
              <label htmlFor="studentLastName" className="block text-xs font-medium text-gray-600 mb-1">
                Nom (indicatif)
              </label>
              <input
                id="studentLastName"
                type="text"
                value={studentLastNameInput}
                onChange={(e) => setStudentLastNameInput(e.target.value)}
                placeholder="ex : Martin"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                disabled={isSubmittingInvitation}
              />
            </div>
          </div>

          <div>
            <label htmlFor="studentLoginIdentifier" className="block text-xs font-medium text-gray-600 mb-1">
              Identifiant de l'élève <span className="text-red-500">*</span>
            </label>
            <input
              id="studentLoginIdentifier"
              type="text"
              required
              value={studentLoginIdentifierInput}
              onChange={(e) => setStudentLoginIdentifierInput(e.target.value)}
              placeholder="ex : lucas.martin"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              disabled={isSubmittingInvitation}
            />
            <p className="text-xs text-gray-400 mt-1">
              Identifiant de connexion communiqué par l'élève ou l'établissement.
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
            disabled={isSubmittingInvitation || !studentLoginIdentifierInput.trim()}
            className="bg-indigo-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmittingInvitation ? 'Envoi…' : 'Envoyer une invitation'}
          </button>
        </form>
      </div>

      {/* Sous-zone 3 — Demandes student_initiated en attente */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-3">
          Accepter la déclaration d'un élève
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
        ) : pendingStudentRequests.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune invitation en attente.</p>
        ) : (
          <ul className="space-y-3">
            {pendingStudentRequests.map((request) => {
              const isProcessing = processingRequestIds.has(request.id)
              return (
                <li
                  key={request.id}
                  className="p-4 bg-gray-50 border border-gray-200 rounded-xl"
                >
                  <p className="text-sm font-medium text-gray-800 mb-1">
                    {pendingStudentNames[request.studentId] ?? 'Chargement…'} souhaite vous déclarer comme financeur
                  </p>
                  <p className="text-xs text-gray-500 mb-1">
                    Demande de rattachement élève
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
