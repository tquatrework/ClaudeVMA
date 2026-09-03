/**
 * TutorialCatalogPage — catalogue des Tutoriels/Vidéos.
 *
 * Refonte du 2026-09-03 (`docs/architecture.md` > « Refonte des Tutos/Vidéos »), remplace
 * intégralement l'ancien écran (modèle académie/activité/news × texte/mixte/vidéo) sur le même
 * patron visuel et fonctionnel que `QuizzPage`/`ExerciseCatalogPage`/`EvaluationCatalogPage` :
 * recherche par tag/mot-clé, pagination, création (formateur/AP/RP), onglet « Mes Tutoriels » pour
 * retrouver/modifier/resoumettre ses propres créations, et onglet « Validation » intégré
 * directement dans cette page (pas un écran séparé, leçon retenue dès cette première livraison —
 * `docs/architecture.md` rappelle l'erreur initiale du chantier Quizz, corrigée après coup le
 * 2026-08-29).
 *
 * Pas d'onglet « historique » : aucun suivi de consultation/progression n'est demandé pour ce
 * type de contenu (hors périmètre explicite de la refonte du 2026-09-03).
 *
 * Routes API consommées :
 *   GET  /tutorials                     (content-catalog-service — recherche, et « mes
 *                                         tutoriels » via `authorId`)
 *   GET  /tutorials/pending-validation  (content-catalog-service — file de validation RP/AP)
 *   POST /tutorials                     (content-catalog-service — création)
 *   POST /validations/tutorial/:id/decision (content-catalog-service — décision de validation)
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useAsyncData } from '../hooks/useAsyncData'
import { useMyTutorials } from '../hooks/content-catalog/useMyTutorials'
import { useTutorialValidationQueue } from '../hooks/content-catalog/useTutorialValidationQueue'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { Tabs, TabPanel } from '../components/ui/Tabs'
import { TutorialCreationSection } from '../components/content-catalog/TutorialCreationSection'
import { TutorialSearchCatalog } from '../components/content-catalog/TutorialSearchCatalog'
import { MyTutorialsList } from '../components/content-catalog/MyTutorialsList'
import { TutorialValidationList } from '../components/content-catalog/TutorialValidationList'
import { searchTutorials } from '../api/tutorials'
import type { PublicTutorialDetail } from '../types/tutorial'

const PAGE_SIZE = 20

export default function TutorialCatalogPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'catalog' | 'mine' | 'validation'>('catalog')
  const [tagFilter, setTagFilter] = useState('')
  const [keywordFilter, setKeywordFilter] = useState('')
  const [appliedTag, setAppliedTag] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [justCreatedTutorial, setJustCreatedTutorial] = useState<PublicTutorialDetail | null>(null)

  const canCreateTutorial = hasRole('formateur', 'animateur_pedagogique', 'responsable_pedagogique')
  const canValidateTutorial = hasRole('responsable_pedagogique', 'animateur_pedagogique')

  const {
    data: searchResult,
    isLoading,
    error: loadError,
    refetch,
  } = useAsyncData(
    () =>
      searchTutorials({
        tag: appliedTag || undefined,
        keyword: appliedKeyword || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    [appliedTag, appliedKeyword, page],
    { fallbackErrorMessage: 'Impossible de charger les tutoriels.' },
  )

  const {
    items: myTutorials,
    isLoading: isLoadingMyTutorials,
    error: myTutorialsError,
    refetch: refetchMyTutorials,
  } = useMyTutorials()

  const {
    items: pendingValidationTutorials,
    isLoading: isLoadingValidationQueue,
    error: validationQueueError,
    decide: decideValidationQueue,
  } = useTutorialValidationQueue(canValidateTutorial)

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setPage(1)
    setAppliedTag(tagFilter.trim())
    setAppliedKeyword(keywordFilter.trim())
  }

  const totalPages = searchResult ? Math.max(1, Math.ceil(searchResult.total / PAGE_SIZE)) : 1

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader title="Tutos-vidéos" subtitle="Des ressources pédagogiques à consulter à son rythme." />

        <TutorialCreationSection
          canCreateTutorial={canCreateTutorial}
          onOpenCreateForm={() => setJustCreatedTutorial(null)}
          onTutorialCreated={(createdTutorial) => setJustCreatedTutorial(createdTutorial)}
          onListsChanged={() => {
            refetch()
            refetchMyTutorials()
          }}
        />

        {justCreatedTutorial && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
            <p className="text-sm text-green-800">
              Tutoriel « {justCreatedTutorial.title} » créé avec succès. Que souhaitez-vous faire ?
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate(`/content/tutorials/${justCreatedTutorial.id}`)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
              >
                Voir le tutoriel
              </button>
              <button
                type="button"
                onClick={() => navigate(`/content/tutorials/${justCreatedTutorial.id}/edit`)}
                className="px-4 py-2 text-sm font-medium text-indigo-700 bg-white border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors"
              >
                Modifier le tutoriel
              </button>
              <button
                type="button"
                onClick={() => setJustCreatedTutorial(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        <Tabs
          ariaLabel="Sections Tutos-vidéos"
          tabs={[
            { id: 'catalog', label: 'Catalogue' },
            ...(canCreateTutorial ? [{ id: 'mine', label: 'Mes Tutoriels' }] : []),
            ...(canValidateTutorial ? [{ id: 'validation', label: 'Validation' }] : []),
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as 'catalog' | 'mine' | 'validation')}
        />

        <TabPanel tabId="catalog" activeTab={activeTab}>
          <TutorialSearchCatalog
            tagFilter={tagFilter}
            onTagFilterChange={setTagFilter}
            keywordFilter={keywordFilter}
            onKeywordFilterChange={setKeywordFilter}
            onSearchSubmit={handleSearchSubmit}
            isLoading={isLoading}
            loadError={loadError}
            searchResult={searchResult}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onSelectTutorial={(tutorial) => navigate(`/content/tutorials/${tutorial.id}`)}
          />
        </TabPanel>

        {canCreateTutorial && (
          <TabPanel tabId="mine" activeTab={activeTab}>
            {isLoadingMyTutorials && (
              <p className="text-gray-400 text-sm">Chargement de vos tutoriels…</p>
            )}
            {myTutorialsError && <ErrorMessage message={myTutorialsError} />}
            {!isLoadingMyTutorials && !myTutorialsError && (
              <MyTutorialsList tutorials={myTutorials} onResubmitted={() => refetchMyTutorials()} />
            )}
          </TabPanel>
        )}

        {canValidateTutorial && (
          <TabPanel tabId="validation" activeTab={activeTab}>
            <p className="text-sm text-gray-500 mb-3">
              Tutoriels créés par un professeur, en attente de votre validation.
            </p>
            {isLoadingValidationQueue && (
              <p className="text-gray-400 text-sm">Chargement des tutoriels en attente…</p>
            )}
            {validationQueueError && <ErrorMessage message={validationQueueError} />}
            {!isLoadingValidationQueue && !validationQueueError && (
              <TutorialValidationList
                tutorials={pendingValidationTutorials}
                onDecide={decideValidationQueue}
              />
            )}
          </TabPanel>
        )}
      </div>
    </Layout>
  )
}
