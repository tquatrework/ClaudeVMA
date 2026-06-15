/**
 * TeacherRequestPage
 *
 * Page principale pour les demandes professeur — phase 3 spec.
 * Adapte l'affichage selon le rôle de l'utilisateur connecté :
 * - Élève / Parent financeur : formulaire de demande spécifique + changement PP
 * - Responsable Pédagogique : espace de travail RP + liste des demandes
 * - Formateur : boîte de réception des demandes ciblées
 *
 * Routes API consommées :
 * - GET /api/v1/teacher-requests
 * - POST /api/v1/teacher-requests (via SpecificTeacherRequestForm)
 * - POST /api/v1/teacher-requests/pp-change (via ChangePrincipalTeacherDialog)
 */
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import apiClient from '../api/client'
import SpecificTeacherRequestForm from '../components/teacher-requests/SpecificTeacherRequestForm'
import ChangePrincipalTeacherDialog from '../components/teacher-requests/ChangePrincipalTeacherDialog'
import RpTeacherSearchWorkspace from '../components/teacher-requests/RpTeacherSearchWorkspace'
import TeacherRequestInbox from '../components/teacher-requests/TeacherRequestInbox'

interface TeacherRequestSummary {
  id: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'candidates_selected'
  createdAt: string
  description?: string
  studentId?: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  declined: 'Refusée',
  cancelled: 'Annulée',
  candidates_selected: 'Candidats sélectionnés',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  candidates_selected: 'bg-blue-100 text-blue-700',
}

export default function TeacherRequestPage() {
  const { user, hasRole } = useAuth()

  const [requests, setRequests] = useState<TeacherRequestSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [isShowingRequestForm, setIsShowingRequestForm] = useState(false)
  const [isShowingPpChangeDialog, setIsShowingPpChangeDialog] = useState(false)

  const isEleve = hasRole('eleve')
  const isParentFinanceur = hasRole('parent_financeur')
  const isResponsablePedagogique = hasRole('responsable_pedagogique')
  const isFormateur = hasRole('formateur')

  const canCreateRequest = isEleve || isParentFinanceur || isResponsablePedagogique
  const canRequestPpChange = isEleve || isParentFinanceur

  useEffect(() => {
    apiClient
      .get<TeacherRequestSummary[] | { data: TeacherRequestSummary[] }>('/teacher-requests')
      .then(({ data }) => {
        const requestList = Array.isArray(data)
          ? data
          : (data as { data: TeacherRequestSummary[] }).data ?? []
        setRequests(requestList)
      })
      .catch((error: unknown) => {
        const statusCode = (error as { response?: { status?: number } })?.response?.status
        if (statusCode === 403) {
          setErrorMessage('Accès refusé')
        } else {
          setErrorMessage('Impossible de charger les demandes')
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  const handleRequestCreated = (newRequest: { id: string; status: string; createdAt: string; description?: string }) => {
    setRequests((previous) => [newRequest as TeacherRequestSummary, ...previous])
    setIsShowingRequestForm(false)
    setSuccessMessage('Votre demande a bien été soumise')
  }

  const handlePpChangeCreated = () => {
    setIsShowingPpChangeDialog(false)
    setSuccessMessage('Votre demande de changement de professeur principal a été soumise')
  }

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Demandes professeur</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gérez vos demandes d'affectation de formateur
            </p>
          </div>

          {canCreateRequest && !isShowingRequestForm && (
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={() => setIsShowingRequestForm(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Nouvelle demande
              </button>
              {canRequestPpChange && (
                <button
                  onClick={() => setIsShowingPpChangeDialog(true)}
                  className="bg-white text-indigo-600 border border-indigo-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors"
                >
                  Changer le prof principal
                </button>
              )}
            </div>
          )}
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-600 ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center justify-between">
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-400 hover:text-green-600 ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {/* Specific teacher request form */}
        {isShowingRequestForm && (
          <SpecificTeacherRequestForm
            showStudentIdField={isParentFinanceur || isResponsablePedagogique}
            onSuccess={handleRequestCreated}
            onCancel={() => setIsShowingRequestForm(false)}
          />
        )}

        {/* PP change dialog (modal overlay) */}
        {isShowingPpChangeDialog && user && (
          <ChangePrincipalTeacherDialog
            studentId={user.id}
            onSuccess={handlePpChangeCreated}
            onCancel={() => setIsShowingPpChangeDialog(false)}
          />
        )}

        {/* Role-specific panels */}
        {isResponsablePedagogique && (
          <RpTeacherSearchWorkspace />
        )}

        {isFormateur && user && (
          <TeacherRequestInbox currentTeacherId={user.id} />
        )}

        {/* My requests list (for students, parents, RP) */}
        {!isFormateur && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-gray-800">
              {isResponsablePedagogique ? 'Toutes les demandes' : 'Mes demandes'}
            </h2>

            {isLoading && (
              <p className="text-gray-400 text-sm">Chargement…</p>
            )}

            {!isLoading && requests.length === 0 && (
              <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
                <p className="text-gray-400 text-sm">Aucune demande</p>
                {canCreateRequest && (
                  <button
                    onClick={() => setIsShowingRequestForm(true)}
                    className="mt-3 text-indigo-600 hover:underline text-sm"
                  >
                    Créer la première demande
                  </button>
                )}
              </div>
            )}

            {!isLoading && requests.length > 0 && (
              <ul className="space-y-3">
                {requests.map((request) => (
                  <li key={request.id}>
                    <Link
                      to={`/teacher-requests/${request.id}`}
                      className="block p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800">
                          Demande #{request.id.slice(0, 8)}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            STATUS_COLORS[request.status] ?? 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {STATUS_LABELS[request.status] ?? request.status}
                        </span>
                      </div>
                      {request.description && (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                          {request.description}
                        </p>
                      )}
                      {request.studentId && (
                        <p className="mt-1 text-xs text-gray-400">
                          Élève : {request.studentId.slice(0, 8)}…
                        </p>
                      )}
                      <p className="mt-2 text-xs text-gray-400">
                        {new Date(request.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
