/**
 * TeacherCandidatesView
 *
 * Vue des candidats formateurs pour une demande professeur.
 *
 * RP : peut ajouter des candidats via POST /api/v1/teacher-requests/{id}/candidates
 * Client (élève/parent) : peut sélectionner un candidat via POST /api/v1/teacher-requests/{id}/select
 * Formateur : peut répondre via POST /api/v1/teacher-requests/{id}/responses
 */
import React, { useState } from 'react'
import { useTeacherCandidates } from '../../hooks/teacher-requests/useTeacherCandidates'

export interface TeacherCandidate {
  id: string
  teacherId: string
  teacherName?: string
  teacherEmail?: string
  status: 'pending' | 'accepted' | 'declined'
  addedAt: string
}

interface TeacherCandidatesViewProps {
  requestId: string
  candidates: TeacherCandidate[]
  isRp: boolean
  isFormateur: boolean
  isClient: boolean
  currentUserId?: string
  requestStatus: string
  onCandidatesUpdated: (updatedCandidates: TeacherCandidate[]) => void
  onRequestStatusChange: (newStatus: string) => void
}

export default function TeacherCandidatesView({
  requestId,
  candidates,
  isRp,
  isFormateur,
  isClient,
  currentUserId,
  requestStatus,
  onCandidatesUpdated,
  onRequestStatusChange,
}: TeacherCandidatesViewProps) {
  const [isAddingCandidate, setIsAddingCandidate] = useState(false)
  const [candidateTeacherId, setCandidateTeacherId] = useState('')

  const {
    isSubmittingCandidate,
    processingCandidateId,
    errorMessage,
    successMessage,
    clearError,
    clearSuccess,
    addCandidate,
    respondAsTeacher,
    selectCandidate,
  } = useTeacherCandidates(requestId)

  const handleAddCandidate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!candidateTeacherId.trim()) return

    const updatedCandidates = await addCandidate(candidateTeacherId.trim())
    if (updatedCandidates !== null) {
      onCandidatesUpdated(updatedCandidates ?? candidates)
      setCandidateTeacherId('')
      setIsAddingCandidate(false)
    }
  }

  const handleTeacherResponse = async (
    candidateId: string,
    responseStatus: 'accepted' | 'declined',
  ) => {
    const succeeded = await respondAsTeacher(candidateId, responseStatus)
    if (succeeded) {
      const updatedCandidates = candidates.map((candidate) =>
        candidate.id === candidateId
          ? { ...candidate, status: responseStatus }
          : candidate,
      )
      onCandidatesUpdated(updatedCandidates)
    }
  }

  const handleSelectCandidate = async (candidateId: string) => {
    const status = await selectCandidate(candidateId)
    if (status !== null) {
      onRequestStatusChange(status)
    }
  }

  const isRequestOpen = requestStatus === 'pending' || requestStatus === 'candidates_selected'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          Candidats ({candidates.length})
        </h2>
        {isRp && isRequestOpen && (
          <button
            onClick={() => setIsAddingCandidate(true)}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            + Ajouter un candidat
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-600 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            onClick={clearSuccess}
            className="text-green-400 hover:text-green-600 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Add candidate form (RP only) */}
      {isRp && isAddingCandidate && (
        <form onSubmit={handleAddCandidate} className="space-y-3 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID du formateur <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={candidateTeacherId}
              onChange={(event) => setCandidateTeacherId(event.target.value)}
              placeholder="UUID du formateur à proposer"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmittingCandidate || !candidateTeacherId.trim()}
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmittingCandidate ? 'Ajout…' : 'Ajouter'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingCandidate(false)
                setCandidateTeacherId('')
              }}
              className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-300"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Candidates list */}
      {candidates.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          Aucun candidat pour le moment
        </p>
      ) : (
        <ul className="space-y-3">
          {candidates.map((candidate) => {
            const isCurrentUserTeacher =
              isFormateur && currentUserId === candidate.teacherId
            const isProcessing = processingCandidateId === candidate.id

            return (
              <li
                key={candidate.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {candidate.teacherName ?? `Formateur ${candidate.teacherId.slice(0, 8)}…`}
                  </p>
                  {candidate.teacherEmail && (
                    <p className="text-xs text-gray-500">{candidate.teacherEmail}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    Ajouté le{' '}
                    {new Date(candidate.addedAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {candidate.status === 'accepted' && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Accepté
                    </span>
                  )}
                  {candidate.status === 'declined' && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      Refusé
                    </span>
                  )}
                  {candidate.status === 'pending' && (
                    <>
                      {/* Formateur can accept/decline their own candidacy */}
                      {isCurrentUserTeacher && (
                        <>
                          <button
                            disabled={isProcessing}
                            onClick={() => handleTeacherResponse(candidate.id, 'accepted')}
                            className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {isProcessing ? '…' : 'Accepter'}
                          </button>
                          <button
                            disabled={isProcessing}
                            onClick={() => handleTeacherResponse(candidate.id, 'declined')}
                            className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                          >
                            Refuser
                          </button>
                        </>
                      )}
                      {/* Client (élève/parent) can select an accepted candidate */}
                      {!isCurrentUserTeacher && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                          En attente
                        </span>
                      )}
                    </>
                  )}

                  {/* Client can select an accepted candidate to close the request */}
                  {isClient && candidate.status === 'accepted' && isRequestOpen && (
                    <button
                      disabled={isProcessing}
                      onClick={() => handleSelectCandidate(candidate.id)}
                      className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isProcessing ? '…' : 'Choisir'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
