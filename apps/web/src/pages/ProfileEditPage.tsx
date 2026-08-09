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
import Layout from '../components/Layout'
import { AdministrativeProfileForm } from '../components/profile/AdministrativeProfileForm'
import { PedagogicalProfileForm } from '../components/profile/PedagogicalProfileForm'
import { PrescriptionForm } from '../components/profile/PrescriptionForm'
import { Tabs, TabPanel, type TabDefinition } from '../components/ui/Tabs'
import { resolvePedagogicalProfileKind } from '../utils/profileFields'
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

  const [activeTab, setActiveTab] = useState<string>(TAB_ADMINISTRATIVE)

  const {
    administrative,
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
  } = useProfileForm(userId)

  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isViewingOwnProfile = userId === user?.id

  const canEditPedagogical =
    hasRole('eleve', 'formateur') ||
    (hasRole('responsable_pedagogique') && !isViewingOwnProfile) ||
    hasRole('technicien_informatique')

  /** La prescription est réservée au RP, y compris sur son propre profil. */
  const canEditPrescription = hasRole('responsable_pedagogique')

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

        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        <TabPanel tabId={TAB_ADMINISTRATIVE} activeTab={activeTab}>
          <AdministrativeProfileForm
            profile={administrative ?? EMPTY_ADMINISTRATIVE_PROFILE}
            isSaving={isSavingAdministrative}
            onSubmit={handleAdminSubmit}
            onCancel={goBackToProfile}
          />
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
              <UndeterminedProfileNotice />
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
              <UndeterminedProfileNotice />
            )}
          </TabPanel>
        )}
      </div>
    </Layout>
  )
}

/**
 * Ni le serveur ni les données enregistrées ne disent s'il s'agit d'un profil
 * élève ou formateur : proposer un formulaire au hasard écrirait dans la
 * mauvaise table.
 */
function UndeterminedProfileNotice() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">
      <p>
        Le profil pédagogique de cette personne n'a jamais été renseigné : sa forme (élève ou
        formateur) ne peut pas être déterminée depuis cet écran.
      </p>
      <p className="mt-2">
        Demandez à la personne concernée de le compléter depuis son propre profil.
      </p>
    </div>
  )
}
