/**
 * RpUserDirectoryPage — `/rp/visualisation`, réservée au responsable pédagogique.
 *
 * Nouvelle entrée « Visualisation » du groupe « Gestion » du rail RP
 * (reconstruction du 2026-09-02, `docs/architecture.md` > « Reconstruction du
 * rail gauche du Responsable Pédagogique (RP) ») : un point d'accès structuré
 * aux différentes catégories d'utilisateurs (élèves, parents, professeurs, AP).
 *
 * **Complétée le 2026-09-02** pour couvrir les 4 rôles via la nouvelle route
 * `GET /profiles/directory/by-role` (livrée par `profile-service`, PR #209),
 * en remplacement du seul annuaire formateurs (`GET /profiles/teachers/validated`)
 * branché dans une première passe. Contrat désormais confirmé par
 * `docs/routes.md` — voir `UserDirectoryEntry` (`src/types/profile.ts`) : chaque
 * tuile affiche, en plus du nom, la photo (`avatarUrl`, résolue via
 * `PersonTile`/`useReadOnlyAvatar`) et le niveau suivi (élève) ou les niveaux
 * enseignés + matières (formateur/AP), via `formatDirectoryEntrySubtitle`.
 *
 * Chaque tuile (`PersonTile`, extraite de `ParentDashboardPage` — « le
 * composant de tuile déjà existant qui présente un élève à son parent
 * financeur ») porte des actions **différenciées par rôle** (complément du
 * 2026-09-02, `docs/architecture.md` > « Compléments demandés le 2026-09-02… »,
 * point 2) : élève → Profil, Calendrier, Cahier de texte, Mémos (le lien
 * « Mémos » réutilise exactement le mécanisme déjà en place côté formateur
 * sur `MyStudentsPage` — bouton ouvrant `MemoReadOnlyModal` alimentée par
 * `GET /memos/students/:studentId`, jamais une nouvelle route de navigation
 * `/memos` qui ne sait afficher que le mémo de l'appelant lui-même) ;
 * professeur/AP → Profil, Calendrier (le Cahier de texte n'a pas de sens sur
 * un formateur, c'est une notion par élève) ; parent financeur → Profil seul.
 * Aucun UUID n'est jamais affiché ; `userId` ne sert qu'à construire ces
 * actions et à résoudre la photo.
 *
 * **Point 3 (« Contacts essentiels »), même complément** : investigation
 * menée avant toute construction, conformément à la consigne. Résultat —
 * élève → professeurs est **déjà** couvert par `ProfilePage` (panneau
 * « Formateurs liés », visible pour RP/AP/TI/AF/formateur sur le profil de
 * n'importe quel élève, pas seulement le sien) : le bouton « Profil » de
 * cette page y mène déjà, rien à dupliquer ici. Les autres directions
 * (élève→parents, parent→élèves, professeur→élèves, professeur→AP,
 * AP→professeurs) ne sont **pas** affichées à un tiers sur `ProfilePage`
 * aujourd'hui — gaps documentés dans le rapport de session, pas comblés ici
 * (certains n'ont même aucune route backend pour les servir).
 */

import React, { useState } from 'react'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { EmptyState } from '../components/ui/EmptyState'
import { Tabs, TabPanel } from '../components/ui/Tabs'
import { PersonTile, type PersonTileAction } from '../components/ui/PersonTile'
import { MemoReadOnlyModal } from '../components/pedagogical-log/MemoReadOnlyModal'
import { useUserDirectoryByRole } from '../hooks/profile/useUserDirectoryByRole'
import { formatPersonDisplayName } from '../utils/nameFormat'
import { formatDirectoryEntrySubtitle } from '../utils/userDirectoryFormat'
import type { UserDirectoryEntry } from '../types/profile'
import type { UserRole } from '../types/user'

type DirectoryTabId = 'eleves' | 'parents' | 'formateurs' | 'animateurs'

const TABS: { id: DirectoryTabId; label: string; role: UserRole; genericLabel: string }[] = [
  { id: 'eleves', label: 'Élèves', role: 'eleve', genericLabel: 'Élève' },
  { id: 'parents', label: 'Parents financeurs', role: 'parent_financeur', genericLabel: 'Parent financeur' },
  { id: 'formateurs', label: 'Professeurs', role: 'formateur', genericLabel: 'Professeur' },
  {
    id: 'animateurs',
    label: 'Animateurs pédagogiques',
    role: 'animateur_pedagogique',
    genericLabel: 'Animateur pédagogique',
  },
]

/**
 * Actions de tuile différenciées par rôle (point 2 du complément 2026-09-02) :
 * élève → Profil/Calendrier/Cahier de texte/Mémos ; professeur/AP →
 * Profil/Calendrier ; parent financeur → Profil seul.
 *
 * `onOpenMemos` n'est fourni (et donc utilisé) que pour le rôle `eleve`.
 */
function buildTileActions(
  role: UserRole,
  userId: string,
  onOpenMemos: (() => void) | undefined,
): PersonTileAction[] {
  const profileAction: PersonTileAction = { label: 'Profil', to: `/profiles/${userId}` }

  if (role === 'parent_financeur') {
    return [profileAction]
  }

  if (role === 'formateur' || role === 'animateur_pedagogique') {
    return [profileAction, { label: 'Calendrier', to: `/calendar?studentId=${userId}` }]
  }

  // role === 'eleve'
  const actions: PersonTileAction[] = [
    profileAction,
    { label: 'Calendrier', to: `/calendar?studentId=${userId}` },
    { label: 'Cahier de texte', to: `/pedagogical-log?studentId=${userId}` },
  ]
  if (onOpenMemos) {
    actions.push({ label: 'Mémos', onClick: onOpenMemos })
  }
  return actions
}

function DirectoryList({
  entries,
  role,
  genericLabel,
  onOpenMemosFor,
}: {
  entries: UserDirectoryEntry[]
  role: UserRole
  genericLabel: string
  onOpenMemosFor?: (entry: UserDirectoryEntry) => void
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,_minmax(280px,_1fr))] gap-4">
      {entries.map((entry) => (
        <PersonTile
          key={entry.userId}
          displayName={formatPersonDisplayName(entry.firstName, entry.lastName, undefined, genericLabel)}
          subtitle={formatDirectoryEntrySubtitle(entry)}
          actions={buildTileActions(
            role,
            entry.userId,
            onOpenMemosFor ? () => onOpenMemosFor(entry) : undefined,
          )}
          // Pas d'appel réseau pour une personne sans photo connue — le champ
          // `avatarUrl` de l'annuaire le dit déjà, inutile de tenter et d'essuyer
          // un 404 côté `useReadOnlyAvatar`.
          photoUserId={entry.avatarUrl ? entry.userId : undefined}
        />
      ))}
    </div>
  )
}

function DirectoryTabPanel({
  role,
  isEnabled,
  genericLabel,
  emptyMessage,
  onOpenMemosFor,
}: {
  role: UserRole
  isEnabled: boolean
  genericLabel: string
  emptyMessage: string
  onOpenMemosFor?: (entry: UserDirectoryEntry) => void
}) {
  const { entries, isLoading, loadError, isTruncated } = useUserDirectoryByRole(role, isEnabled)

  if (isLoading) {
    return <p className="text-gray-400 text-sm">Chargement…</p>
  }

  if (loadError) {
    return <ErrorMessage message={loadError} />
  }

  if (entries.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  return (
    <div className="space-y-3">
      {isTruncated && (
        <ErrorMessage
          variant="warning"
          message="La liste est très longue : seules les premières entrées sont affichées."
        />
      )}
      <DirectoryList
        entries={entries}
        role={role}
        genericLabel={genericLabel}
        onOpenMemosFor={onOpenMemosFor}
      />
    </div>
  )
}

const DEFAULT_TAB: DirectoryTabId = 'eleves'

export default function RpUserDirectoryPage() {
  const [activeTab, setActiveTab] = useState<DirectoryTabId>(DEFAULT_TAB)

  // Mémo consulté depuis l'onglet « Élèves » (point 2 du complément 2026-09-02) —
  // même pattern que `MyStudentsPage` : un état local minimal, pas de route dédiée.
  const [memoModalEntry, setMemoModalEntry] = useState<UserDirectoryEntry | null>(null)

  // Une fois activé, un onglet reste « chargeable » pour toujours — même règle
  // que `TabPanel` (montage paresseux puis maintien, 2026-08-10) : revenir sur
  // un onglet déjà visité ne doit jamais relancer un chargement. `isEnabled`
  // ne doit donc pas redevenir `false` quand `activeTab` change, sans quoi
  // `useUserDirectoryByRole` retomberait dans son état « en attente pour
  // toujours » (`pendingForever`) à chaque changement d'onglet.
  const [activatedTabs, setActivatedTabs] = useState<ReadonlySet<DirectoryTabId>>(
    () => new Set([DEFAULT_TAB]),
  )

  const handleTabChange = (id: string) => {
    const tabId = id as DirectoryTabId
    setActiveTab(tabId)
    setActivatedTabs((previous) => (previous.has(tabId) ? previous : new Set(previous).add(tabId)))
  }

  return (
    <Layout>
      <div className="max-w-5xl space-y-6">
        <PageHeader
          title="Visualisation"
          subtitle="Accès structuré aux élèves, parents financeurs, professeurs et animateurs pédagogiques de la plateforme."
        />

        <Tabs
          tabs={TABS.map(({ id, label }) => ({ id, label }))}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          ariaLabel="Catégories d'utilisateurs"
        />

        {TABS.map(({ id, role, genericLabel }) => (
          <TabPanel key={id} tabId={id} activeTab={activeTab}>
            <DirectoryTabPanel
              role={role}
              isEnabled={activatedTabs.has(id)}
              genericLabel={genericLabel}
              emptyMessage={`Aucun compte de type « ${genericLabel.toLowerCase()} » pour l'instant.`}
              onOpenMemosFor={role === 'eleve' ? setMemoModalEntry : undefined}
            />
          </TabPanel>
        ))}

        {memoModalEntry && (
          <MemoReadOnlyModal
            studentId={memoModalEntry.userId}
            title={`Mémo de ${formatPersonDisplayName(memoModalEntry.firstName, memoModalEntry.lastName, undefined, 'Élève')}`}
            onClose={() => setMemoModalEntry(null)}
          />
        )}
      </div>
    </Layout>
  )
}
