import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfileForm } from '../hooks/profile/useProfileForm'
import Layout from '../components/Layout'
import { AdministrativeProfileForm } from '../components/profile/AdministrativeProfileForm'
import { PedagogicalProfileForm } from '../components/profile/PedagogicalProfileForm'
import { resolvePedagogicalProfileKind } from '../utils/profileFields'
import type { AdministrativeProfileFields, PedagogicalProfileFields } from '../types/profile'

type ActiveTab = 'administrative' | 'pedagogical'

const EMPTY_ADMINISTRATIVE_PROFILE: AdministrativeProfileFields = {}

export default function ProfileEditPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()

  const [activeTab, setActiveTab] = useState<ActiveTab>('administrative')

  const {
    administrative,
    pedagogical,
    isLoading,
    loadError,
    saveAdministrative,
    isSavingAdministrative,
    administrativeSaveError,
    savePedagogical,
    isSavingPedagogical,
    pedagogicalSaveError,
  } = useProfileForm(userId)

  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const canEditPedagogical =
    hasRole('eleve', 'formateur') ||
    (hasRole('responsable_pedagogique') && userId !== user?.id) ||
    hasRole('technicien_informatique')

  /**
   * Forme du profil pédagogique à éditer. Le rôle du compte connecté ne sert de
   * repli que sur son PROPRE profil : `GET /profiles/:userId` n'expose pas le rôle
   * de la personne consultée, un RP/TI éditant un tiers au profil pédagogique
   * encore vierge obtient donc `unknown`.
   */
  const isViewingOwnProfile = userId === user?.id
  const pedagogicalKind = useMemo(
    () =>
      resolvePedagogicalProfileKind(
        pedagogical,
        isViewingOwnProfile ? user?.role : undefined,
      ),
    [pedagogical, isViewingOwnProfile, user?.role],
  )

  const error =
    activeTab === 'administrative'
      ? administrativeSaveError ?? loadError
      : pedagogicalSaveError ?? loadError

  const [isErrorDismissed, setIsErrorDismissed] = useState(false)
  useEffect(() => {
    setIsErrorDismissed(false)
  }, [error])

  const handleAdminSubmit = async (payload: AdministrativeProfileFields) => {
    setSuccessMessage(null)
    const isSaved = await saveAdministrative(payload)
    if (isSaved) setSuccessMessage('Profil administratif mis à jour')
  }

  const handlePedagogicalSubmit = async (payload: PedagogicalProfileFields) => {
    setSuccessMessage(null)
    const isSaved = await savePedagogical(payload)
    if (isSaved) setSuccessMessage('Profil pédagogique mis à jour')
  }

  const goBackToProfile = () => navigate(`/profiles/${userId}`)

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
          <button onClick={goBackToProfile} className="text-sm text-indigo-600 hover:underline">
            ← Retour au profil
          </button>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Modifier le profil</h1>

        {error && !isErrorDismissed && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setIsErrorDismissed(true)}
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

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('administrative')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'administrative'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Profil administratif
          </button>
          {canEditPedagogical && (
            <button
              onClick={() => setActiveTab('pedagogical')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'pedagogical'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Profil pédagogique
            </button>
          )}
        </div>

        {activeTab === 'administrative' && (
          <AdministrativeProfileForm
            profile={administrative ?? EMPTY_ADMINISTRATIVE_PROFILE}
            isSaving={isSavingAdministrative}
            onSubmit={handleAdminSubmit}
            onCancel={goBackToProfile}
          />
        )}

        {activeTab === 'pedagogical' && canEditPedagogical && pedagogicalKind !== 'unknown' && (
          <PedagogicalProfileForm
            kind={pedagogicalKind}
            profile={pedagogical ?? null}
            isSaving={isSavingPedagogical}
            onSubmit={handlePedagogicalSubmit}
            onCancel={goBackToProfile}
          />
        )}

        {activeTab === 'pedagogical' && canEditPedagogical && pedagogicalKind === 'unknown' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">
            <p>
              Le profil pédagogique de cette personne n'a jamais été renseigné : sa forme (élève ou
              formateur) ne peut pas être déterminée depuis cet écran.
            </p>
            <p className="mt-2">
              Demandez à la personne concernée de le compléter depuis son propre profil.
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
