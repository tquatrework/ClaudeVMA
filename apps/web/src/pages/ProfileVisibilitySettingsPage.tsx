import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

interface VisibilityPreferences {
  showEmailToTeachers: boolean
  showPhoneToTeachers: boolean
  showAddressToTeachers: boolean
  showProgressToParents: boolean
  showCalendarToParents: boolean
}

const DEFAULT_PREFERENCES: VisibilityPreferences = {
  showEmailToTeachers: false,
  showPhoneToTeachers: false,
  showAddressToTeachers: false,
  showProgressToParents: true,
  showCalendarToParents: true,
}

const PREFERENCE_LABELS: Record<keyof VisibilityPreferences, string> = {
  showEmailToTeachers: 'Afficher mon adresse e-mail aux formateurs',
  showPhoneToTeachers: 'Afficher mon numéro de téléphone aux formateurs',
  showAddressToTeachers: 'Afficher mon adresse postale aux formateurs',
  showProgressToParents: 'Autoriser mes parents à voir ma progression',
  showCalendarToParents: 'Autoriser mes parents à voir mon calendrier',
}

/**
 * Page de préférences de confidentialité d'un élève.
 * Accessible à l'élève (soi-même) ou au RP / TI.
 */
export default function ProfileVisibilitySettingsPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()

  const [preferences, setPreferences] = useState<VisibilityPreferences>(DEFAULT_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isViewingOwnProfile = user?.id === userId
  const canAccess =
    isViewingOwnProfile ||
    hasRole('responsable_pedagogique', 'technicien_informatique')

  useEffect(() => {
    if (!userId || !canAccess) return

    setIsLoading(true)
    apiClient
      .get<VisibilityPreferences>(`/profiles/${userId}/visibility-preferences`)
      .then(({ data }) => {
        setPreferences({ ...DEFAULT_PREFERENCES, ...data })
      })
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setErrorMessage('Accès refusé')
        else if (status === 404) setErrorMessage('Préférences introuvables')
        else setErrorMessage('Erreur lors du chargement des préférences')
      })
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const handleToggle = (preferenceKey: keyof VisibilityPreferences) => {
    setPreferences((prev) => ({ ...prev, [preferenceKey]: !prev[preferenceKey] }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return

    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await apiClient.patch(`/profiles/${userId}/visibility-preferences`, preferences)
      setSuccessMessage('Préférences de confidentialité enregistrées')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Erreur lors de l'enregistrement"
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  if (!canAccess) {
    return (
      <Layout>
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Accès refusé
        </div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-400">Chargement…</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(`/profiles/${userId}`)}
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Retour au profil
          </button>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Confidentialité</h1>
        <p className="text-sm text-gray-500 mb-6">
          Choisissez quelles informations sont visibles selon votre rôle.
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
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
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center justify-between">
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-400 hover:text-green-600 ml-3"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800 mb-2">
              Visibilité envers les formateurs
            </h2>
            {(
              [
                'showEmailToTeachers',
                'showPhoneToTeachers',
                'showAddressToTeachers',
              ] as (keyof VisibilityPreferences)[]
            ).map((preferenceKey) => (
              <label key={preferenceKey} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences[preferenceKey]}
                  onChange={() => handleToggle(preferenceKey)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                />
                <span className="text-sm text-gray-700">{PREFERENCE_LABELS[preferenceKey]}</span>
              </label>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800 mb-2">
              Visibilité envers les parents
            </h2>
            {(
              [
                'showProgressToParents',
                'showCalendarToParents',
              ] as (keyof VisibilityPreferences)[]
            ).map((preferenceKey) => (
              <label key={preferenceKey} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences[preferenceKey]}
                  onChange={() => handleToggle(preferenceKey)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                />
                <span className="text-sm text-gray-700">{PREFERENCE_LABELS[preferenceKey]}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
            >
              {isSaving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/profiles/${userId}`)}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}
