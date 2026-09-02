/**
 * RpUserDirectoryPage — `/rp/visualisation`, réservée au responsable pédagogique.
 *
 * Nouvelle entrée « Visualisation » du groupe « Gestion » du rail RP
 * (reconstruction du 2026-09-02, `docs/architecture.md` > « Reconstruction du
 * rail gauche du Responsable Pédagogique (RP) ») : un point d'accès structuré
 * aux différentes catégories d'utilisateurs (élèves, parents, professeurs, AP).
 *
 * Investigation faite avant construction (règle du projet : ne jamais inventer
 * de route). Seul un annuaire réel existe côté serveur pour cette famille de
 * besoin : `GET /profiles/teachers/validated` (formateurs validés, déjà
 * consommé par `useSelectableTeachers`, réservé aux administrateurs). Aucune
 * route de liste n'existe pour les élèves, les parents financeurs ou les
 * animateurs pédagogiques — `GET /profiles/:userId` exige déjà un identifiant
 * et ne permet donc pas de « parcourir », et aucune route inverse
 * (« tous les élèves », « tous les parents », « tous les AP ») n'est
 * documentée dans `docs/routes.md`. Plutôt que de simuler un écran vide ou de
 * fabriquer une route, ces trois onglets affichent un état « fonctionnalité
 * indisponible » explicite — voir le rapport de livraison pour le détail du
 * gap à faire arbitrer côté backend si cette liste est un jour nécessaire.
 *
 * Chaque formateur de l'annuaire renvoie vers sa fiche complète
 * (`/profiles/:userId`, déjà ouverte à tout compte authentifié côté route,
 * le filtrage de droit se faisant côté serveur) — jamais l'UUID affiché comme
 * libellé (règle du 2026-08-09), seulement utilisé pour construire le lien.
 */

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { EmptyState } from '../components/ui/EmptyState'
import { Tabs, TabPanel } from '../components/ui/Tabs'
import { useSelectableTeachers } from '../hooks/teacher-requests/useSelectableTeachers'

type DirectoryTabId = 'formateurs' | 'eleves' | 'parents' | 'animateurs'

const TABS = [
  { id: 'formateurs' as const, label: 'Professeurs' },
  { id: 'eleves' as const, label: 'Élèves' },
  { id: 'parents' as const, label: 'Parents financeurs' },
  { id: 'animateurs' as const, label: 'Animateurs pédagogiques' },
]

/** Message français unique pour les trois catégories sans route de liste côté serveur. */
function UnavailableDirectory({ category }: { category: string }) {
  return (
    <EmptyState
      message={`Aucun annuaire de ${category} n'existe encore côté serveur : cette liste n'est pas disponible pour l'instant. La fiche d'une personne reste consultable individuellement depuis les écrans qui la concernent (demandes, cahier de texte, relations…).`}
    />
  )
}

function TeacherDirectoryTab() {
  const { teachers, isLoading, loadError, isTruncated } = useSelectableTeachers(true)

  if (isLoading) {
    return <p className="text-gray-400 text-sm">Chargement…</p>
  }

  if (loadError) {
    return <ErrorMessage message={loadError} />
  }

  if (teachers.length === 0) {
    return <EmptyState message="Aucun professeur validé pour l'instant." />
  }

  return (
    <div className="space-y-3">
      {isTruncated && (
        <ErrorMessage
          variant="warning"
          message="La liste est très longue : seules les premières entrées sont affichées."
        />
      )}
      <ul className="space-y-2">
        {teachers.map((teacher) => (
          <li key={teacher.userId}>
            <Link
              to={`/profiles/${teacher.userId}`}
              className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{teacher.displayName}</p>
                {teacher.expertise && (
                  <p className="text-xs text-gray-500 mt-0.5">{teacher.expertise}</p>
                )}
              </div>
              <span className="text-xs text-indigo-600 font-medium shrink-0">Voir la fiche →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function RpUserDirectoryPage() {
  const [activeTab, setActiveTab] = useState<DirectoryTabId>('formateurs')

  return (
    <Layout>
      <div className="max-w-3xl space-y-6">
        <PageHeader
          title="Visualisation"
          subtitle="Accès structuré aux différentes catégories d'utilisateurs de la plateforme."
        />

        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as DirectoryTabId)} />

        <TabPanel tabId="formateurs" activeTab={activeTab}>
          <TeacherDirectoryTab />
        </TabPanel>
        <TabPanel tabId="eleves" activeTab={activeTab}>
          <UnavailableDirectory category="élèves" />
        </TabPanel>
        <TabPanel tabId="parents" activeTab={activeTab}>
          <UnavailableDirectory category="parents financeurs" />
        </TabPanel>
        <TabPanel tabId="animateurs" activeTab={activeTab}>
          <UnavailableDirectory category="animateurs pédagogiques" />
        </TabPanel>
      </div>
    </Layout>
  )
}
