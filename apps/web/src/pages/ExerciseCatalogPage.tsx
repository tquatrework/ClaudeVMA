/**
 * ExerciseCatalogPage — catalogue des Exercices (refonte du 2026-08-29).
 *
 * Recherche par tag/mot-clé, pagination, ouverture d'un exercice pour le passer (auto-contrôle),
 * création (formateur/AP/RP), historique personnel des tentatives, onglet « Mes Exercices » pour
 * retrouver/modifier/resoumettre ses propres créations, et onglet « Validation » pour que RP/AP
 * valident ou rejettent directement depuis cette page — même patron que `QuizzPage`, leçon du
 * 2026-08-29 sur la découvrabilité de la validation reprise dès la première livraison.
 *
 * Routes API consommées :
 *   GET  /exercises                        (content-catalog-service — recherche, et « mes
 *                                            exercices » via `authorId`)
 *   GET  /exercises/pending-validation      (content-catalog-service — file de validation RP/AP)
 *   POST /exercises                         (content-catalog-service — création)
 *   POST /validations/exercise/:id/decision (content-catalog-service — décision de validation)
 *   GET  /exercise-attempts/history         (learning-activity-service — historique)
 *
 * **Mode « choix pour une Évaluation en cours » (2026-09-02)** : atteint depuis les boutons
 * « Nouveau »/« Rechercher » d'`EvaluationExercisePicker` — voir `useExercisePickerReturnMode`.
 * Le mot-clé de recherche est pré-rempli, le formulaire de création s'ouvre automatiquement en
 * intention « create », et choisir/créer un Exercice ramène vers la création d'Évaluation en
 * cours avec cet Exercice ajouté, au lieu du comportement normal (fiche de détail / bandeau de
 * succès sur cette page).
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useAsyncData } from '../hooks/useAsyncData'
import { useExerciseAttemptHistory } from '../hooks/learning-activity/useExerciseAttemptHistory'
import { useMyExercises } from '../hooks/content-catalog/useMyExercises'
import { useExerciseValidationQueue } from '../hooks/content-catalog/useExerciseValidationQueue'
import { useExercisePickerReturnMode } from '../hooks/content-catalog/useExercisePickerReturnMode'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { Tabs, TabPanel } from '../components/ui/Tabs'
import { ExerciseCreationSection } from '../components/content-catalog/ExerciseCreationSection'
import { ExerciseSearchCatalog } from '../components/content-catalog/ExerciseSearchCatalog'
import { ExerciseAttemptHistoryList } from '../components/learning-activity/ExerciseAttemptHistoryList'
import { MyExercisesList } from '../components/content-catalog/MyExercisesList'
import { ExerciseValidationList } from '../components/content-catalog/ExerciseValidationList'
import { searchExercises } from '../api/exercises'
import { getExerciseDisplayTitle } from '../utils/exerciseLabels'
import type { PublicExerciseDetail } from '../types/exercise'

const PAGE_SIZE = 20

export default function ExerciseCatalogPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const pickerReturn = useExercisePickerReturnMode()

  const [activeTab, setActiveTab] = useState<'catalog' | 'history' | 'mine' | 'validation'>(
    'catalog',
  )
  const [tagFilter, setTagFilter] = useState('')
  const [keywordFilter, setKeywordFilter] = useState(() => pickerReturn.prefillKeyword ?? '')
  const [appliedTag, setAppliedTag] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState(() => pickerReturn.prefillKeyword ?? '')
  const [page, setPage] = useState(1)
  const [justCreatedExercise, setJustCreatedExercise] = useState<PublicExerciseDetail | null>(null)

  const canCreateExercise = hasRole('formateur', 'animateur_pedagogique', 'responsable_pedagogique')
  const canValidateExercise = hasRole('responsable_pedagogique', 'animateur_pedagogique')

  const {
    data: searchResult,
    isLoading,
    error: loadError,
    refetch,
  } = useAsyncData(
    () =>
      searchExercises({
        tag: appliedTag || undefined,
        keyword: appliedKeyword || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    [appliedTag, appliedKeyword, page],
    { fallbackErrorMessage: 'Impossible de charger les exercices.' },
  )

  const { entries: historyEntries, isLoading: isLoadingHistory, error: historyError } =
    useExerciseAttemptHistory()

  const {
    items: myExercises,
    isLoading: isLoadingMyExercises,
    error: myExercisesError,
    refetch: refetchMyExercises,
  } = useMyExercises()

  const {
    items: pendingValidationExercises,
    isLoading: isLoadingValidationQueue,
    error: validationQueueError,
    decide: decideValidationQueue,
  } = useExerciseValidationQueue(canValidateExercise)

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
        <PageHeader title="Exercices" subtitle="Des exercices d'auto-contrôle, à votre rythme." />

        {pickerReturn.isPicking && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-indigo-800">
              {pickerReturn.intent === 'create'
                ? "Créez votre exercice — vous reviendrez ensuite sur l'évaluation en cours, avec cet exercice ajouté."
                : "Choisissez un exercice ci-dessous pour l'ajouter à l'évaluation en cours."}
            </p>
            <button
              type="button"
              onClick={pickerReturn.returnWithoutExercise}
              className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-white border border-indigo-300 rounded-md hover:bg-indigo-100 transition-colors shrink-0"
            >
              Retour sans ajouter
            </button>
          </div>
        )}

        <ExerciseCreationSection
          canCreateExercise={canCreateExercise}
          autoOpen={pickerReturn.intent === 'create'}
          onOpenCreateForm={() => setJustCreatedExercise(null)}
          onExerciseCreated={(createdExercise) => {
            if (pickerReturn.isPicking) {
              pickerReturn.returnWithExercise({
                id: createdExercise.id,
                title: getExerciseDisplayTitle(createdExercise.title),
              })
              return
            }
            setJustCreatedExercise(createdExercise)
          }}
          onListsChanged={() => {
            refetch()
            refetchMyExercises()
          }}
        />

        {justCreatedExercise && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
            <p className="text-sm text-green-800">
              Exercice « {getExerciseDisplayTitle(justCreatedExercise.title)} » créé avec succès.
              Que souhaitez-vous faire ?
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate(`/content/exercises/${justCreatedExercise.id}`)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
              >
                Voir l'exercice
              </button>
              <button
                type="button"
                onClick={() => navigate(`/content/exercises/${justCreatedExercise.id}/edit`)}
                className="px-4 py-2 text-sm font-medium text-indigo-700 bg-white border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors"
              >
                Modifier / ajouter des images
              </button>
              <button
                type="button"
                onClick={() => setJustCreatedExercise(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        <Tabs
          ariaLabel="Sections Exercices"
          tabs={[
            { id: 'catalog', label: 'Catalogue' },
            { id: 'history', label: 'Mon historique' },
            ...(canCreateExercise ? [{ id: 'mine', label: 'Mes Exercices' }] : []),
            ...(canValidateExercise ? [{ id: 'validation', label: 'Validation' }] : []),
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as 'catalog' | 'history' | 'mine' | 'validation')}
        />

        <TabPanel tabId="catalog" activeTab={activeTab}>
          <ExerciseSearchCatalog
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
            onSelectExercise={(exercise) => {
              if (pickerReturn.isPicking) {
                pickerReturn.returnWithExercise({
                  id: exercise.id,
                  title: getExerciseDisplayTitle(exercise.title),
                })
                return
              }
              navigate(`/content/exercises/${exercise.id}`)
            }}
          />
        </TabPanel>

        <TabPanel tabId="history" activeTab={activeTab}>
          {isLoadingHistory && <p className="text-gray-400 text-sm">Chargement de l'historique…</p>}
          {historyError && <ErrorMessage message={historyError} />}
          {!isLoadingHistory && !historyError && (
            <ExerciseAttemptHistoryList entries={historyEntries} />
          )}
        </TabPanel>

        {canCreateExercise && (
          <TabPanel tabId="mine" activeTab={activeTab}>
            {isLoadingMyExercises && (
              <p className="text-gray-400 text-sm">Chargement de vos exercices…</p>
            )}
            {myExercisesError && <ErrorMessage message={myExercisesError} />}
            {!isLoadingMyExercises && !myExercisesError && (
              <MyExercisesList exercises={myExercises} onResubmitted={() => refetchMyExercises()} />
            )}
          </TabPanel>
        )}

        {canValidateExercise && (
          <TabPanel tabId="validation" activeTab={activeTab}>
            <p className="text-sm text-gray-500 mb-3">
              Exercices créés par un professeur, en attente de votre validation.
            </p>
            {isLoadingValidationQueue && (
              <p className="text-gray-400 text-sm">Chargement des exercices en attente…</p>
            )}
            {validationQueueError && <ErrorMessage message={validationQueueError} />}
            {!isLoadingValidationQueue && !validationQueueError && (
              <ExerciseValidationList
                exercises={pendingValidationExercises}
                onDecide={decideValidationQueue}
              />
            )}
          </TabPanel>
        )}
      </div>
    </Layout>
  )
}
