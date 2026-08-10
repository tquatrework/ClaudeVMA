/**
 * ProfileEditPage — édition d'un profil, une route d'écriture par onglet :
 *
 * - « Profil administratif » → `PUT /profiles/:userId/administrative` ;
 * - « Profil pédagogique » → `PUT /profiles/:userId/pedagogical` (section
 *   déclarative, ce que le titulaire dit de lui) ;
 * - « Préconisations » → `PUT /profiles/:userId/prescription`, **RP seul**.
 *
 * L'onglet des préconisations n'est pas affiché aux autres rôles : la règle de
 * filtrage UI du projet interdit de proposer une porte qui répondrait `403`.
 * Le serveur reste seul juge — le front n'en déduit pas sa propre règle, il
 * évite juste l'impasse et traduit le refus s'il survient.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfileForm } from '../hooks/profile/useProfileForm'
import { useTabSelection } from '../hooks/useTabSelection'
import Layout from '../components/Layout'
import { AdministrativeProfileForm } from '../components/profile/AdministrativeProfileForm'
import { PedagogicalProfileForm } from '../components/profile/PedagogicalProfileForm'
import { PrescriptionForm } from '../components/profile/PrescriptionForm'
import { ProfileAvatarField } from '../components/profile/ProfileAvatarField'
import { UndeterminedPedagogicalProfileNotice } from '../components/profile/UndeterminedPedagogicalProfileNotice'
import { Tabs, TabPanel, type TabDefinition } from '../components/ui/Tabs'
import { formatFullName } from '../utils/nameFormat'
import { resolvePedagogicalProfileKind } from '../utils/profileFields'
import {
  canEditDeclarativePedagogicalProfile,
  canEditPrescription as canRoleEditPrescription,
  canEditProfileAvatar,
} from '../utils/profilePermissions'
import type {
  AdministrativeProfileFields,
  DeclarativePedagogicalFields,
  PrescriptionFields,
} from '../types/profile'

const TAB_ADMINISTRATIVE = 'administrative'
const TAB_PEDAGOGICAL = 'pedagogical'
const TAB_PRESCRIPTION = 'prescription'

const EMPTY_ADMINISTRATIVE_PROFILE: AdministrativeProfileFields = {}

export default function ProfileEditPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()

  const {
    administrative,
    avatarUrl,
    pedagogical,
    pedagogicalType,
    isLoading,
    loadError,
    saveAdministrative,
    isSavingAdministrative,
    administrativeSaveError,
    savePedagogical,
    isSavingPedagogical,
    pedagogicalSaveError,
    savePrescription,
    isSavingPrescription,
    prescriptionSaveError,
    refreshProfile,
  } = useProfileForm(userId)

  /**
   * Chaque clic d'onglet redemande le profil au serveur — règle générale du
   * front. Les valeurs déjà saisies et non enregistrées sont préservées : les
   * formulaires ne se réinitialisent que si le serveur renvoie des valeurs
   * différentes.
   */
  const { activeTab, selectTab } = useTabSelection(TAB_ADMINISTRATIVE, refreshProfile)

  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isViewingOwnProfile = userId === user?.id

  // Droits d'écriture : mêmes helpers que la fiche, pour que les deux écrans
  // n'ouvrent jamais deux portes différentes sur la même route serveur.
  const canEditPedagogical = canEditDeclarativePedagogicalProfile(user?.role, isViewingOwnProfile)

  /** La prescription est réservée au RP, y compris sur son propre profil. */
  const canEditPrescription = canRoleEditPrescription(user?.role)

  /** La photo n'est changée que par son titulaire, RP et TI compris. */
  const canEditAvatar = canEditProfileAvatar(isViewingOwnProfile)

  /**
   * Forme du profil pédagogique : `pedagogicalType` du serveur d'abord. Le rôle
   * ne sert de repli que sur son PROPRE profil — `GET /profiles/:userId` n'expose
   * pas le rôle de la personne consultée —, puis les champs déjà enregistrés.
   */
  const pedagogicalKind = useMemo(
    () =>
      resolvePedagogicalProfileKind(
        pedagogicalType,
        pedagogical,
        isViewingOwnProfile ? user?.role : undefined,
      ),
    [pedagogicalType, pedagogical, isViewingOwnProfile, user?.role],
  )

  const saveErrorByTab: Record<string, string | null> = {
    [TAB_ADMINISTRATIVE]: administrativeSaveError,
    [TAB_PEDAGOGICAL]: pedagogicalSaveError,
    [TAB_PRESCRIPTION]: prescriptionSaveError,
  }
  const error = saveErrorByTab[activeTab] ?? loadError

  const [isErrorDismissed, setIsErrorDismissed] = useState(false)
  useEffect(() => {
    setIsErrorDismissed(false)
  }, [error])

  const handleAdminSubmit = async (payload: AdministrativeProfileFields) => {
    setSuccessMessage(null)
    const isSaved = await saveAdministrative(payload)
    if (isSaved) setSuccessMessage('Profil administratif mis à jour')
  }

  const handlePedagogicalSubmit = async (payload: DeclarativePedagogicalFields) => {
    setSuccessMessage(null)
    const isSaved = await savePedagogical(payload)
    if (isSaved) setSuccessMessage('Profil pédagogique mis à jour')
  }

  const handlePrescriptionSubmit = async (payload: PrescriptionFields) => {
    setSuccessMessage(null)
    const isSaved = await savePrescription(payload)
    if (isSaved) setSuccessMessage('Préconisations enregistrées')
  }

  const goBackToProfile = () => navigate(`/profiles/${userId}`)

  const tabs: TabDefinition[] = [
    { id: TAB_ADMINISTRATIVE, label: 'Profil administratif' },
    ...(canEditPedagogical ? [{ id: TAB_PEDAGOGICAL, label: 'Profil pédagogique' }] : []),
    ...(canEditPrescription ? [{ id: TAB_PRESCRIPTION, label: 'Préconisations' }] : []),
  ]

  const isPedagogicalKindKnown = pedagogicalKind !== 'unknown'

  /**
   * Écran d'attente au **premier** chargement seulement. Une relecture de
   * fraîcheur (après un changement de photo) laisse les formulaires en place :
   * les remplacer par « Chargement… » les démonterait, et la saisie en cours
   * serait perdue au moment le moins attendu.
   */
  const isInitialLoading = isLoading && administrative === undefined

  if (isInitialLoading) {
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

        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={selectTab} />

        <TabPanel tabId={TAB_ADMINISTRATIVE} activeTab={activeTab}>
          <div className="space-y-6">
            {/* La photo se change ici aussi, mais par ses propres routes : elle
                n'est pas un champ du formulaire, et l'envoyer au `PUT` vaudrait
                `400`. Seul le titulaire en dispose. */}
            <ProfileAvatarField
              userId={userId}
              avatarUrl={avatarUrl}
              displayName={formatFullName(administrative?.firstName, administrative?.lastName)}
              canEdit={canEditAvatar}
              onAvatarChanged={refreshProfile}
            />

            <AdministrativeProfileForm
              profile={administrative ?? EMPTY_ADMINISTRATIVE_PROFILE}
              isSaving={isSavingAdministrative}
              onSubmit={handleAdminSubmit}
              onCancel={goBackToProfile}
            />
          </div>
        </TabPanel>

        {canEditPedagogical && (
          <TabPanel tabId={TAB_PEDAGOGICAL} activeTab={activeTab}>
            {isPedagogicalKindKnown ? (
              <PedagogicalProfileForm
                pedagogicalType={pedagogicalKind}
                profile={pedagogical ?? null}
                isSaving={isSavingPedagogical}
                onSubmit={handlePedagogicalSubmit}
                onCancel={goBackToProfile}
              />
            ) : (
              <UndeterminedPedagogicalProfileNotice />
            )}
          </TabPanel>
        )}

        {canEditPrescription && (
          <TabPanel tabId={TAB_PRESCRIPTION} activeTab={activeTab}>
            {isPedagogicalKindKnown ? (
              <PrescriptionForm
                pedagogicalType={pedagogicalKind}
                profile={pedagogical ?? null}
                isSaving={isSavingPrescription}
                onSubmit={handlePrescriptionSubmit}
                onCancel={goBackToProfile}
              />
            ) : (
              <UndeterminedPedagogicalProfileNotice />
            )}
          </TabPanel>
        )}
      </div>
    </Layout>
  )
}
