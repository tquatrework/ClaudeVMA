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
 * branché dans une première passe. Voir `useUserDirectoryByRole` et
 * `UserDirectoryEntry` (`src/types/profile.ts`) pour les réserves sur le
 * contrat exact de cette route, non documentée dans `docs/routes.md` au moment
 * de cette implémentation — seul le socle garanti ailleurs dans ce projet
 * (prénom, nom) est affiché, aucun champ additionnel n'est deviné.
 *
 * Chaque tuile (`PersonTile`, extraite de `ParentDashboardPage` — « le
 * composant de tuile déjà existant qui présente un élève à son parent
 * financeur ») porte trois actions vers des écrans déjà existants et déjà
 * ouverts au RP côté route : profil, calendrier, cahier de texte — rien de
 * plus, comme demandé explicitement. Aucun UUID n'est jamais affiché ;
 * `userId` ne sert qu'à construire ces liens.
 */

import React, { useState } from 'react'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { EmptyState } from '../components/ui/EmptyState'
import { Tabs, TabPanel } from '../components/ui/Tabs'
import { PersonTile } from '../components/ui/PersonTile'
import { useUserDirectoryByRole } from '../hooks/profile/useUserDirectoryByRole'
import { formatPersonDisplayName } from '../utils/nameFormat'
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

function buildTileActions(userId: string) {
  return [
    { label: 'Profil', to: `/profiles/${userId}` },
    { label: 'Calendrier', to: `/calendar?studentId=${userId}` },
    { label: 'Cahier de texte', to: `/pedagogical-log?studentId=${userId}` },
  ]
}

function DirectoryList({
  entries,
  genericLabel,
}: {
  entries: UserDirectoryEntry[]
  genericLabel: string
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,_minmax(280px,_1fr))] gap-4">
      {entries.map((entry) => (
        <PersonTile
          key={entry.userId}
          displayName={formatPersonDisplayName(entry.firstName, entry.lastName, undefined, genericLabel)}
          actions={buildTileActions(entry.userId)}
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
}: {
  role: UserRole
  isEnabled: boolean
  genericLabel: string
  emptyMessage: string
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
      <DirectoryList entries={entries} genericLabel={genericLabel} />
    </div>
  )
}

const DEFAULT_TAB: DirectoryTabId = 'eleves'

export default function RpUserDirectoryPage() {
  const [activeTab, setActiveTab] = useState<DirectoryTabId>(DEFAULT_TAB)

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
            />
          </TabPanel>
        ))}
      </div>
    </Layout>
  )
}
