import React, { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfileDetails } from '../hooks/profile/useProfileDetails'
import Layout from '../components/Layout'
import TeacherValidationPanel from './TeacherValidationPanel'
import ProfileStatisticsPanel from './ProfileStatisticsPanel'
import ParentFinanceurSection from '../components/profile/ParentFinanceurSection'
import LinkedStudentsSection from '../components/profile/LinkedStudentsSection'
import { Tabs, TabPanel, type TabDefinition } from '../components/ui/Tabs'
import { InternalNotesPanel } from '../components/profile/InternalNotesPanel'
import { LinkedTeachersPanel } from '../components/profile/LinkedTeachersPanel'
import { ProfileSection } from '../components/profile/ProfileSection'
import { PedagogicalProfilePanel } from '../components/profile/PedagogicalProfilePanel'
import { FilteredProfileNotice } from '../components/profile/FilteredProfileNotice'
import {
  ADMINISTRATIVE_DISPLAY_FIELD_NAMES,
  pickAdministrativeDisplayFields,
  resolvePedagogicalProfileKind,
} from '../utils/profileFields'
import { pickHiddenFieldNames } from '../utils/profileVisibility'

// ─── IDs d'onglets ────────────────────────────────────────────────────────────

const TAB_ADMIN = 'admin'
const TAB_PEDAGOGIQUE = 'pedagogique'
const TAB_RELATIONS = 'relations'
const TAB_CONFIDENTIALITE = 'confidentialite'
const TAB_DOCUMENTS = 'documents'

// ─── Composant principal ───────────────────────────────────────────────────────

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user, hasRole } = useAuth()

  const [activeTab, setActiveTab] = useState<string>(TAB_ADMIN)

  const isViewingOwnProfile = user?.id === userId
  const canSeeInternalNotes = hasRole('responsable_pedagogique', 'administrateur_financier')
  const canSeeRelations = hasRole(
    'responsable_pedagogique',
    'animateur_pedagogique',
    'technicien_informatique',
    'administrateur_financier',
    'formateur',
  )
  const canSeeValidationPanel = hasRole('responsable_pedagogique', 'technicien_informatique')

  /**
   * Onglet "relations" : visible pour l'élève (ses parents) ou le parent (ses élèves)
   * sur leur propre profil uniquement.
   */
  const showRelationsTab = isViewingOwnProfile && hasRole('eleve', 'parent_financeur')

  /**
   * Onglet "confidentialité" : visible sur son propre profil, ou pour RP/TI sur tout profil.
   */
  const showConfidentialiteTab =
    isViewingOwnProfile || hasRole('responsable_pedagogique', 'technicien_informatique')

  /**
   * Le profil financier est visible uniquement pour les rôles ayant une dimension financière :
   * parent_financeur, formateur, animateur_pedagogique, responsable_pedagogique, administrateur_financier.
   * L'élève n'a pas de profil financier propre.
   */
  const canSeeFinancialProfile = isViewingOwnProfile && hasRole(
    'parent_financeur',
    'formateur',
    'animateur_pedagogique',
    'responsable_pedagogique',
    'administrateur_financier',
  )

  /**
   * Les documents légaux (mandats, contrats) sont accessibles depuis le profil pour
   * les rôles qui ont perdu l'entrée directe dans le menu gauche :
   * élève, formateur, parent_financeur — ainsi que les rôles admin qui y avaient déjà accès.
   * L'entrée n'est affichée que sur son propre profil.
   */
  const canSeeDocumentsLegaux = isViewingOwnProfile && hasRole(
    'eleve',
    'formateur',
    'parent_financeur',
    'animateur_pedagogique',
    'responsable_pedagogique',
    'administrateur_financier',
    'technicien_informatique',
  )

  // ─── Chargement des données ──────────────────────────────────────────────────

  const {
    profile,
    teacherRelations,
    internalNotes,
    isLoading,
    loadError,
    addNote,
    isSavingNote,
    noteSaveError,
  } = useProfileDetails(userId, canSeeRelations, canSeeInternalNotes)

  /**
   * Forme du profil pédagogique : `pedagogicalType` renvoyé par le serveur fait
   * foi. Le rôle ne sert de repli que sur son propre profil — `GET /profiles/:userId`
   * n'expose pas le rôle de la personne consultée.
   */
  const pedagogicalKind = useMemo(
    () =>
      resolvePedagogicalProfileKind(
        profile?.pedagogicalType,
        profile?.pedagogical,
        isViewingOwnProfile ? user?.role : undefined,
      ),
    [profile?.pedagogicalType, profile?.pedagogical, isViewingOwnProfile, user?.role],
  )

  // ─── Construction de la liste d'onglets ─────────────────────────────────────

  const tabs: TabDefinition[] = [
    { id: TAB_ADMIN, label: 'Profil administratif' },
    { id: TAB_PEDAGOGIQUE, label: 'Profil pédagogique' },
    ...(showRelationsTab
      ? [
          {
            id: TAB_RELATIONS,
            label: hasRole('eleve') ? 'Parents financeurs' : 'Mes élèves / enfants',
          },
        ]
      : []),
    ...(showConfidentialiteTab ? [{ id: TAB_CONFIDENTIALITE, label: 'Confidentialité' }] : []),
    ...(canSeeDocumentsLegaux ? [{ id: TAB_DOCUMENTS, label: 'Documents légaux' }] : []),
  ]

  // ─── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="w-full">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Fiche profil</h1>
          {(isViewingOwnProfile || hasRole('responsable_pedagogique', 'technicien_informatique')) && (
            <Link
              to={`/profiles/${userId}/edit`}
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Modifier
            </Link>
          )}
        </div>

        {isLoading && <p className="text-gray-400">Chargement…</p>}

        {loadError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {loadError}
          </div>
        )}

        {profile && (
          <>
            {/* Une fois par fiche : dire pourquoi des champs portent « Non partagé »,
                avant que le lecteur ne conclue à un oubli du titulaire. */}
            <FilteredProfileNotice visibility={profile.visibility} />

            <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

            {/* ── Onglet 1 : Profil administratif ── */}
            <TabPanel tabId={TAB_ADMIN} activeTab={activeTab}>
              <div className="space-y-6">
                {/* Le bloc `administrative` est filtré, jamais affiché tel quel :
                    il porte aussi `userId`, identifiant technique sans valeur
                    pour le titulaire de la fiche.
                    Les champs non partagés en sont absents : leurs noms viennent
                    de `visibility.hiddenFields`, pas du bloc lui-même. */}
                <ProfileSection
                  data={pickAdministrativeDisplayFields(profile.administrative)}
                  emptyMessage="Aucune donnée administrative"
                  hiddenFieldNames={pickHiddenFieldNames(
                    ADMINISTRATIVE_DISPLAY_FIELD_NAMES,
                    profile.visibility,
                  )}
                />

                {/* Profil financier — rôles ayant une dimension financière, sur leur propre profil */}
                {canSeeFinancialProfile && (
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-800">Profil financier</h2>
                        <p className="text-sm text-gray-500 mt-1">
                          Moyens de paiement, crédits et historique financier
                        </p>
                      </div>
                      <Link
                        to="/finance"
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        Gérer →
                      </Link>
                    </div>
                  </div>
                )}

                {/* Panneau de validation formateur (RP / TI) — placé dans l'onglet admin */}
                {canSeeValidationPanel && userId && (
                  <TeacherValidationPanel teacherId={userId} />
                )}

                {/* Formateurs liés — visible pour RP, AP, TI, AF, formateur */}
                {canSeeRelations && (
                  <LinkedTeachersPanel teacherRelations={teacherRelations} />
                )}

                {/* Notes internes — RP / administrateur financier */}
                {canSeeInternalNotes && (
                  <InternalNotesPanel
                    internalNotes={internalNotes}
                    addNote={addNote}
                    isSavingNote={isSavingNote}
                    noteSaveError={noteSaveError}
                  />
                )}
              </div>
            </TabPanel>

            {/* ── Onglet 2 : Profil pédagogique ── */}
            <TabPanel tabId={TAB_PEDAGOGIQUE} activeTab={activeTab}>
              <div className="space-y-6">
                {/* Deux sections : ce que le titulaire déclare, et ce que le RP
                    prescrit sur lui — lisible par le titulaire, jamais modifiable
                    par lui. */}
                <PedagogicalProfilePanel
                  pedagogicalKind={pedagogicalKind}
                  pedagogical={profile.pedagogical ?? null}
                  visibility={profile.visibility}
                />

                {/* Statistiques pédagogiques */}
                {userId && <ProfileStatisticsPanel userId={userId} />}
              </div>
            </TabPanel>

            {/* ── Onglet 3 : Parents financeurs / Mes élèves ── */}
            {showRelationsTab && userId && (
              <TabPanel tabId={TAB_RELATIONS} activeTab={activeTab}>
                {hasRole('eleve') ? (
                  <ParentFinanceurSection studentId={userId} />
                ) : (
                  <LinkedStudentsSection parentId={userId} />
                )}
              </TabPanel>
            )}

            {/* ── Onglet 4 : Confidentialité ── */}
            {showConfidentialiteTab && (
              <TabPanel tabId={TAB_CONFIDENTIALITE} activeTab={activeTab}>
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-800">Confidentialité</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Gérez la visibilité de vos informations
                      </p>
                    </div>
                    <Link
                      to={`/profiles/${userId}/visibility`}
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      Gérer →
                    </Link>
                  </div>
                </div>
              </TabPanel>
            )}

            {/* ── Onglet 5 : Documents légaux ── */}
            {canSeeDocumentsLegaux && (
              <TabPanel tabId={TAB_DOCUMENTS} activeTab={activeTab}>
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-800">Documents légaux</h2>
                        <p className="text-sm text-gray-500 mt-1">
                          Mandats, contrats et documents à signer
                        </p>
                      </div>
                      <Link
                        to="/legal"
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        Consulter →
                      </Link>
                    </div>
                  </div>
                </div>
              </TabPanel>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
