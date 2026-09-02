import React, { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfileDetails } from '../hooks/profile/useProfileDetails'
import Layout from '../components/Layout'
import TeacherValidationPanel from '../components/profile/TeacherValidationPanel'
import ParentFinanceurSection from '../components/profile/ParentFinanceurSection'
import LinkedStudentsSection from '../components/profile/LinkedStudentsSection'
import { Tabs, TabPanel, type TabDefinition } from '../components/ui/Tabs'
import { InternalNotesPanel } from '../components/profile/InternalNotesPanel'
import { LinkedTeachersPanel } from '../components/profile/LinkedTeachersPanel'
import { LinkedFinanceRelationsPanel } from '../components/profile/LinkedFinanceRelationsPanel'
import { AnimatedTeachersPanel } from '../components/profile/AnimatedTeachersPanel'
import { TerminateTeacherRelationDialog } from '../components/profile/TerminateTeacherRelationDialog'
import { AdministrativeProfilePanel } from '../components/profile/AdministrativeProfilePanel'
import { PedagogicalProfilePanel } from '../components/profile/PedagogicalProfilePanel'
import { FilteredProfileNotice } from '../components/profile/FilteredProfileNotice'
import { ProfileLinkCard } from '../components/profile/ProfileLinkCard'
import { ProfileConsentsSection } from '../components/profile/ProfileConsentsSection'
import { ThirdPartyNotebookSection } from '../components/profile/ThirdPartyNotebookSection'
import { resolvePedagogicalProfileKind } from '../utils/profileFields'
import {
  canEditAdministrativeProfile,
  canEditDeclarativePedagogicalProfile,
  canEditProfileAvatar,
  roleHasFinancialProfile,
  roleHasPedagogicalProfile,
} from '../utils/profilePermissions'
import { FinancialProfilePanel } from '../components/finance/FinancialProfilePanel'
import { useTerminateTeacherRelation } from '../hooks/relations/useTerminateTeacherRelation'
import { describeTeacherRelationName } from '../utils/relationLabels'
import { isAdministratorRole } from '../utils/relationAccess'

// ─── IDs d'onglets ────────────────────────────────────────────────────────────

const TAB_ADMIN = 'admin'
const TAB_PEDAGOGIQUE = 'pedagogique'
const TAB_FINANCIER = 'financier'
const TAB_RELATIONS = 'relations'
const TAB_CONFIDENTIALITE = 'confidentialite'
const TAB_DOCUMENTS = 'documents'

// ─── Composant principal ───────────────────────────────────────────────────────

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user, hasRole } = useAuth()

  const isViewingOwnProfile = user?.id === userId

  /**
   * Droits d'écriture — helpers partagés avec `ProfileEditPage` : la fiche
   * propose des champs saisissables, une règle recopiée y ferait apparaître un
   * formulaire que le serveur refuserait.
   */
  const canEditAdministrative = canEditAdministrativeProfile(user?.role, isViewingOwnProfile)
  const canEditPedagogical = canEditDeclarativePedagogicalProfile(user?.role, isViewingOwnProfile)

  /**
   * La photo est **plus fermée** que le reste du bloc administratif : elle
   * n'appartient au domaine d'aucun rôle administratif, seul le titulaire la
   * change ou la supprime.
   */
  const canEditAvatar = canEditProfileAvatar(isViewingOwnProfile)

  /**
   * Adresse e-mail du compte : elle vient de la **session authentifiée**
   * (`POST /auth/login` puis `GET /auth/me`, `identity-access-service`), jamais du
   * profil — `profile-service` ne la porte pas et la refuse en écriture.
   *
   * Elle n'est donc connue que pour le lecteur lui-même : `GET /profiles/:userId`
   * ne renvoie pas l'e-mail du titulaire consulté, et `GET /accounts/:accountId`
   * répond `403` à tout rôle non administratif. Sur la fiche d'un tiers, on
   * n'affiche rien plutôt qu'une donnée de contact que son titulaire ne peut même
   * pas masquer — le catalogue de visibilité ne la connaît pas.
   */
  const accountEmail = isViewingOwnProfile ? (user?.email ?? null) : null

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
   * Relations financières d'un tiers (point 3, « Contacts essentiels » du
   * complément 2026-09-02, élève ↔ parents) — mêmes rôles que ceux déjà
   * autorisés par `GET /relations/finance-owner-student/by-student/:studentId`
   * et `GET /relations/finance-owner-student/:financeOwnerId` sur un tiers
   * (`docs/routes.md`) : RP, AF, TI. Jamais sur son propre profil — le
   * titulaire a déjà `TAB_RELATIONS` pour ça, avec ses formulaires
   * d'invitation.
   */
  const canSeeFinanceRelationsOfTiers = !isViewingOwnProfile && isAdministratorRole(user?.role)

  /**
   * Professeurs animés par un AP (point 3, « Contacts essentiels », AP →
   * professeurs) — mêmes rôles que `GET /relations/animator-teacher/:animatorId`
   * (`docs/routes.md`) : RP, TI, ou l'AP lui-même. L'AF en est exclu, comme
   * côté serveur. Combiné plus bas (une fois `profile` chargé) à
   * `isTargetAnimateurPedagogique`, qui distingue un profil d'AP d'un profil
   * de formateur non promu — seul un AP a des professeurs animés.
   */
  const canSeeAnimatedTeachersRole =
    hasRole('responsable_pedagogique', 'technicien_informatique') || isViewingOwnProfile

  /**
   * Mettre fin à une relation élève ↔ formateur : réservé au RP, et seulement
   * depuis la fiche de l'élève (arbitrage du 2026-08-12). Ni le formateur, ni
   * l'élève, ni le parent financeur, ni le TI ni l'AF ne voient ce bouton — le
   * serveur les refuserait de toute façon, mais l'action ne doit pas apparaître
   * pour un rôle qu'elle mènerait vers un refus (règle de filtrage UI).
   */
  const canTerminateTeacherRelation = hasRole('responsable_pedagogique')

  /**
   * Carnet personnel d'un tiers, en lecture seule — arbitrage du 2026-08-28.
   * Deux populations distinctes, un seul point d'affichage : RP/AF/TI sur
   * n'importe quelle fiche qui n'est pas la leur, et le parent financeur sur
   * la fiche de son enfant (déjà l'écran où il consulte tout le reste du
   * profil, sauf le carnet — cette section reste la seule exception
   * paramétrable par le TI). Jamais sur son propre profil : le titulaire
   * utilise `/notebook/mine`. `enabled` ne fait qu'éviter un appel réseau
   * inutile ; le serveur reste seul juge du droit réel (réglage TI + relation).
   */
  const canAttemptThirdPartyNotebook =
    !isViewingOwnProfile &&
    hasRole(
      'responsable_pedagogique',
      'administrateur_financier',
      'technicien_informatique',
      'parent_financeur',
    )

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
   * Onglet « Profil financier » — troisième onglet de la fiche depuis le
   * 2026-08-11, demande de l'utilisateur : « le profil financier […] doit en
   * fait être un troisième onglet […] aussi bien pour les parents que pour les
   * formateurs ». Il remplace la carte « Gérer » qui vivait dans l'onglet
   * administratif et renvoyait vers `/finance`.
   *
   * Les rôles concernés sont ceux qui ont un profil financier **à eux**
   * (`roleHasFinancialProfile`) : le parent financeur qui paie, le formateur qui
   * est rémunéré, et l'animateur pédagogique — un formateur promu, rémunéré
   * comme tel. L'élève ne finance rien, c'est son parent financeur qui paie.
   *
   * Effet de bord corrigé au passage : la carte s'affichait pour le formateur et
   * l'AP alors que la route `/finance` leur est fermée — « Gérer » les menait
   * donc à `/forbidden`. L'onglet, lui, n'emprunte aucune route.
   */
  const showFinancierTab = isViewingOwnProfile && roleHasFinancialProfile(user?.role)

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
    avatarUrl,
    setAvatarUrl,
    applySavedAdministrative,
    applySavedPedagogical,
    removeTeacherRelation,
  } = useProfileDetails(userId, canSeeRelations, canSeeInternalNotes)

  const {
    pendingTermination,
    requestTermination,
    cancelTermination,
    reason: terminationReason,
    setReason: setTerminationReason,
    reasonMaxLength: terminationReasonMaxLength,
    isTerminating,
    terminationError,
    confirmTermination,
  } = useTerminateTeacherRelation(removeTeacherRelation)

  /**
   * L'onglet actif est un simple état d'affichage : changer d'onglet ne
   * redemande rien au serveur. Le chargement appartient à la page et a déjà eu
   * lieu au montage ; les panneaux, eux, restent montés d'un onglet à l'autre
   * (voir `TabPanel`).
   */
  const [activeTab, setActiveTab] = useState(TAB_ADMIN)

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

  /**
   * `isAnimateurPedagogique` est un champ « jamais masqué » du bloc pédagogique
   * (`docs/routes.md`) — fiable même pour un lecteur soumis au filtrage champ par
   * champ. Distingue un profil d'AP d'un profil de formateur non promu, pour
   * conditionner `AnimatedTeachersPanel` ci-dessous (point 3, « Contacts
   * essentiels », AP → professeurs).
   */
  const isTargetAnimateurPedagogique = Boolean(
    (profile?.pedagogical as { isAnimateurPedagogique?: unknown } | null | undefined)
      ?.isAnimateurPedagogique,
  )
  const canSeeAnimatedTeachers = isTargetAnimateurPedagogique && canSeeAnimatedTeachersRole

  /**
   * Le parent financeur n'a pas de profil pédagogique : lui en afficher un vide
   * l'inviterait à renseigner un profil qui n'existe pas pour son rôle. On ne
   * masque l'onglet que sur SA fiche — le rôle du titulaire n'est connu que là.
   */
  const showPedagogiqueTab =
    !isViewingOwnProfile || roleHasPedagogicalProfile(user?.role)

  // ─── Construction de la liste d'onglets ─────────────────────────────────────

  const tabs: TabDefinition[] = [
    { id: TAB_ADMIN, label: 'Profil administratif' },
    ...(showPedagogiqueTab ? [{ id: TAB_PEDAGOGIQUE, label: 'Profil pédagogique' }] : []),
    ...(showFinancierTab ? [{ id: TAB_FINANCIER, label: 'Profil financier' }] : []),
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

        {/* Attente affichée tant qu'aucune fiche n'est disponible. Une fiche
            déjà chargée ne repasse jamais sur « Chargement… » : la mise en page
            sauterait sous les yeux du lecteur. */}
        {isLoading && !profile && <p className="text-gray-400">Chargement…</p>}

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
                {/* En tête, l'emplacement de la photo, puis les 11 champs du
                    contrat, toujours tous : en saisie si le lecteur a le droit
                    d'écriture, en lecture sinon. Le bloc reçu n'est jamais
                    affiché tel quel — il porte `userId`, identifiant technique
                    sans valeur pour le titulaire — et les champs non partagés
                    n'en font pas partie : leurs noms viennent de
                    `visibility.hiddenFields`. */}
                <AdministrativeProfilePanel
                  userId={userId}
                  administrative={profile.administrative}
                  visibility={profile.visibility}
                  canEdit={canEditAdministrative}
                  canEditAvatar={canEditAvatar}
                  avatarUrl={avatarUrl}
                  onAvatarUrlChange={setAvatarUrl}
                  accountEmail={accountEmail}
                  onSaved={applySavedAdministrative}
                />

                {/* Panneau de validation formateur (RP / TI) — placé dans l'onglet admin */}
                {canSeeValidationPanel && userId && (
                  <TeacherValidationPanel teacherId={userId} />
                )}

                {/* Formateurs liés — visible pour RP, AP, TI, AF, formateur. Le RP y
                    trouve, sur chaque formateur, de quoi mettre fin à la relation. */}
                {canSeeRelations && (
                  <LinkedTeachersPanel
                    teacherRelations={teacherRelations}
                    canTerminate={canTerminateTeacherRelation}
                    onRequestTermination={requestTermination}
                  />
                )}

                {/* Relations financières d'un tiers (élève ↔ parents), lecture
                    seule — RP/AF/TI uniquement, jamais sur son propre profil
                    (point 3, « Contacts essentiels », complément 2026-09-02). */}
                {canSeeFinanceRelationsOfTiers && userId && (
                  <LinkedFinanceRelationsPanel userId={userId} />
                )}

                {/* Professeurs animés par un AP — RP/TI, ou l'AP lui-même sur
                    son propre profil (point 3, « Contacts essentiels », AP →
                    professeurs, complément 2026-09-02). Ne s'affiche que si le
                    titulaire de la fiche est réellement un AP. */}
                {userId && (
                  <AnimatedTeachersPanel animatorId={userId} enabled={canSeeAnimatedTeachers} />
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

                {/* Carnet personnel du tiers consulté — lecture seule, ne
                    s'affiche que si le réglage TI l'autorise ET que l'appel
                    réussit réellement (voir ThirdPartyNotebookSection). */}
                {canAttemptThirdPartyNotebook && userId && (
                  <ThirdPartyNotebookSection
                    ownerId={userId}
                    enabled={canAttemptThirdPartyNotebook}
                    ownerFirstName={
                      typeof profile.administrative?.firstName === 'string'
                        ? profile.administrative.firstName
                        : null
                    }
                  />
                )}
              </div>
            </TabPanel>

            {/* ── Onglet 2 : Profil pédagogique ── */}
            {showPedagogiqueTab && (
              <TabPanel tabId={TAB_PEDAGOGIQUE} activeTab={activeTab}>
                {/* Deux sections : ce que le titulaire déclare — saisissable
                    par lui, même quand aucun profil pédagogique n'existe
                    encore — et ce que le RP prescrit sur lui, lisible mais
                    jamais modifiable ici.

                    Les statistiques pédagogiques ne sont plus ici : elles ont
                    rejoint « Stats / Archives » (`/archives`), leur destination
                    d'application, le 2026-08-11. Une fiche de profil décrit une
                    personne, elle ne mesure pas sa progression. */}
                <PedagogicalProfilePanel
                  userId={userId}
                  pedagogicalKind={pedagogicalKind}
                  pedagogical={profile.pedagogical ?? null}
                  visibility={profile.visibility}
                  canEdit={canEditPedagogical}
                  onSaved={applySavedPedagogical}
                />
              </TabPanel>
            )}

            {/* ── Onglet 3 : Profil financier ── */}
            {showFinancierTab && userId && (
              <TabPanel tabId={TAB_FINANCIER} activeTab={activeTab}>
                {/* Même panneau que la page `/finance`, monté ici sans sa route :
                    un seul contenu, deux emplacements. Comme les autres onglets,
                    il est monté à sa première ouverture puis conservé — un
                    aller-retour ne redemande rien. */}
                <FinancialProfilePanel ownerId={userId} />
              </TabPanel>
            )}

            {/* ── Onglet 4 : Parents financeurs / Mes élèves ── */}
            {showRelationsTab && userId && (
              <TabPanel tabId={TAB_RELATIONS} activeTab={activeTab}>
                {hasRole('eleve') ? (
                  <ParentFinanceurSection studentId={userId} />
                ) : (
                  <LinkedStudentsSection parentId={userId} />
                )}
              </TabPanel>
            )}

            {/* ── Onglet 5 : Confidentialité ──
                Deux sections, dans cet ordre (décision du 2026-08-18) :
                1. Les consentements RGPD/CGU/marketing — visibles seulement
                   sur SON PROPRE profil : `GET /consents` ne renvoie que les
                   consentements de l'appelant authentifié, jamais ceux d'un
                   tiers. Un RP consultant la fiche d'un élève ne doit pas y
                   voir ses propres consentements à lui.
                2. « Détails » — l'ancienne (et seule) tuile de cet onglet,
                   simplement renommée et déplacée sous les consentements ;
                   comportement inchangé (réglages de visibilité champ par
                   champ, ex-écran `/visibilite`). */}
            {showConfidentialiteTab && (
              <TabPanel tabId={TAB_CONFIDENTIALITE} activeTab={activeTab}>
                <div className="space-y-6">
                  {isViewingOwnProfile && <ProfileConsentsSection />}
                  <ProfileLinkCard
                    title="Détails"
                    description="Gérez la visibilité de vos informations"
                    to={`/profiles/${userId}/visibility`}
                    actionLabel="Gérer"
                  />
                </div>
              </TabPanel>
            )}

            {/* ── Onglet 6 : Documents légaux */}
            {canSeeDocumentsLegaux && (
              <TabPanel tabId={TAB_DOCUMENTS} activeTab={activeTab}>
                <div className="space-y-4">
                  <ProfileLinkCard
                    title="Documents légaux"
                    description="Mandats, contrats et documents à signer"
                    to="/legal"
                    actionLabel="Consulter"
                  />
                </div>
              </TabPanel>
            )}
          </>
        )}

        {pendingTermination && (
          <TerminateTeacherRelationDialog
            teacherName={describeTeacherRelationName(pendingTermination)}
            reason={terminationReason}
            onReasonChange={setTerminationReason}
            reasonMaxLength={terminationReasonMaxLength}
            isSubmitting={isTerminating}
            errorMessage={terminationError}
            onConfirm={confirmTermination}
            onCancel={cancelTermination}
          />
        )}
      </div>
    </Layout>
  )
}
