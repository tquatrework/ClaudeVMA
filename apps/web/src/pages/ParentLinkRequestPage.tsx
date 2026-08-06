import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import {
  createParentLinkRequest,
  fetchParentLinkRequests,
  type ParentLinkRequest,
  type ParentLinkRequestStatus,
} from '../api/parentLinkRequest'
import { useAuth } from '../hooks/useAuth'

const STATUS_LABELS: Record<ParentLinkRequestStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Refusée',
}

const STATUS_BADGE_CLASSES: Record<ParentLinkRequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function ParentLinkRequestPage() {
  const { user } = useAuth()
  // Transmet l'identifiant du parent connecté (soi-même) pour lier automatiquement
  // le nouveau compte élève créé — voir LinkedAccountSection sur StudentRegistrationPage.
  const createStudentAccountLink = user?.loginIdentifier
    ? `/register/student?parentLoginIdentifier=${encodeURIComponent(user.loginIdentifier)}`
    : '/register/student'
  const [studentLoginIdentifierInput, setStudentLoginIdentifierInput] = useState('')
  const [existingRequests, setExistingRequests] = useState<ParentLinkRequest[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingRequests, setIsLoadingRequests] = useState(true)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetchParentLinkRequests()
      .then((requests) => setExistingRequests(requests))
      .catch(() => setLoadError('Impossible de charger vos demandes de rattachement'))
      .finally(() => setIsLoadingRequests(false))
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedLoginIdentifier = studentLoginIdentifierInput.trim()
    if (!trimmedLoginIdentifier) return

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    try {
      const createdRequest = await createParentLinkRequest(trimmedLoginIdentifier)
      setExistingRequests((previous) => [createdRequest, ...previous])
      setStudentLoginIdentifierInput('')
      setSubmitSuccess(true)
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: { message?: string } } }
      if (axiosError.response?.status === 409) {
        setSubmitError('Une demande de rattachement est déjà en cours pour cet élève.')
      } else if (axiosError.response?.status === 404) {
        setSubmitError("Identifiant élève introuvable. Vérifiez l'identifiant communiqué.")
      } else if (axiosError.response?.status === 400) {
        setSubmitError(
          axiosError.response.data?.message ?? "Cet identifiant ne correspond pas à un compte élève.",
        )
      } else {
        setSubmitError('Une erreur est survenue. Veuillez réessayer.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Rattacher un élève</h1>
        <p className="text-sm text-gray-500 mb-6">
          Envoyez une demande de rattachement à un élève. Celui-ci devra l'approuver.
        </p>

        {/* Form */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Nouvelle demande</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="studentLoginIdentifier" className="block text-sm font-medium text-gray-700 mb-1">
                Identifiant de l'élève
              </label>
              <input
                id="studentLoginIdentifier"
                type="text"
                value={studentLoginIdentifierInput}
                onChange={(e) => setStudentLoginIdentifierInput(e.target.value)}
                placeholder="ex : jean.dupont"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-400 mt-1">
                Saisissez l'identifiant communiqué par l'établissement ou l'élève.
              </p>
            </div>

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {submitError}
              </div>
            )}

            {submitSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                Votre demande de rattachement a bien été envoyée.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !studentLoginIdentifierInput.trim()}
                className="bg-indigo-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Envoi…' : 'Envoyer la demande'}
              </button>

              <Link
                to={createStudentAccountLink}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-indigo-300 text-indigo-700 text-sm px-5 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Créer un compte élève
              </Link>
            </div>
          </form>
        </div>

        {/* Existing requests */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Mes demandes</h2>

          {isLoadingRequests ? (
            <p className="text-sm text-gray-400">Chargement…</p>
          ) : loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : existingRequests.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune demande pour le moment.</p>
          ) : (
            <ul className="space-y-3">
              {existingRequests.map((request) => (
                <li
                  key={request.id}
                  className="p-4 bg-white border border-gray-200 rounded-xl flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      Élève : ELV-{request.studentId.slice(0, 8)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Envoyée le{' '}
                      {new Date(request.requestedAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    {request.processedAt && (
                      <p className="text-xs text-gray-400">
                        Traitée le{' '}
                        {new Date(request.processedAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_CLASSES[request.status]}`}
                  >
                    {STATUS_LABELS[request.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  )
}
