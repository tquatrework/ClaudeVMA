/**
 * EvaluationCatalogPage — catalogue des Évaluations (refonte du 2026-09-02).
 *
 * Remplace l'écran de juin 2026 qui appelait des routes retirées côté serveur (voir
 * `docs/routes.md` > content-catalog-service > « Évaluations », « Retiré le 2026-09-01 »). Même
 * patron que `QuizzPage`/`ExerciseCatalogPage` : recherche par tag/mot-clé, onglet « Mon
 * historique », onglet « Mes Évaluations » (création, pas d'édition — voir `MyEvaluationsList`),
 * onglet « Validation » (AP/RP), onglet « Corrections » (formateur/RP — leçon du chantier Quizz :
 * la validation/correction se fait directement depuis cette page, pas un écran séparé peu
 * découvrable).
 *
 * Routes API consommées :
 *   GET  /evaluations                          (content-catalog-service — recherche)
 *   POST /evaluations                          (content-catalog-service — création)
 *   POST /validations/evaluation/:id/decision  (content-catalog-service — décision de validation)
 *   GET  /evaluation-attempts/history           (learning-activity-service — historique)
 *   GET  /evaluation-corrections/pending, /mine (learning-activity-service — corrections)
 */

import React, { useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useAsyncData } from '../hooks/useAsyncData'
import { useEvaluationAttemptHistory } from '../hooks/learning-activity/useEvaluationAttemptHistory'
import { useMyEvaluations } from '../hooks/content-catalog/useMyEvaluations'
import { useEvaluationValidationQueue } from '../hooks/content-catalog/useEvaluationValidationQueue'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { Tabs, TabPanel } from '../components/ui/Tabs'
import { EvaluationCreationSection } from '../components/content-catalog/EvaluationCreationSection'
import { EvaluationSearchCatalog } from '../components/content-catalog/EvaluationSearchCatalog'
import { MyEvaluationsList } from '../components/content-catalog/MyEvaluationsList'
import { EvaluationValidationList } from '../components/content-catalog/EvaluationValidationList'
import { EvaluationAttemptHistoryList } from '../components/learning-activity/EvaluationAttemptHistoryList'
import { EvaluationCorrectionsTab } from '../components/learning-activity/EvaluationCorrectionsTab'
import { searchEvaluations } from '../api/evaluations'
import { getEvaluationDisplayTitle } from '../utils/evaluationLabels'
import type { Evaluation } from '../types/evaluation'

const PAGE_SIZE = 20

type EvaluationTab = 'catalog' | 'history' | 'mine' | 'validation' | 'corrections'

export default function EvaluationCatalogPage() {
  const { hasRole } = useAuth()

  const [activeTab, setActiveTab] = useState<EvaluationTab>('catalog')
  const [tagFilter, setTagFilter] = useState('')
  const [keywordFilter, setKeywordFilter] = useState('')
  const [appliedTag, setAppliedTag] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [justCreatedEvaluation, setJustCreatedEvaluation] = useState<Evaluation | null>(null)

  const canPassEvaluation = hasRole(
    'eleve',
    'formateur',
    'animateur_pedagogique',
    'responsable_pedagogique',
  )
  const canCreateEvaluation = hasRole('formateur', 'animateur_pedagogique', 'responsable_pedagogique')
  const canValidateEvaluation = hasRole('responsable_pedagogique', 'animateur_pedagogique')
  const canCorrectEvaluation = hasRole('formateur', 'responsable_pedagogique')

  const {
    data: searchResult,
    isLoading,
    error: loadError,
    refetch,
  } = useAsyncData(
    () =>
      searchEvaluations({
        tag: appliedTag || undefined,
        keyword: appliedKeyword || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    [appliedTag, appliedKeyword, page],
    { fallbackErrorMessage: 'Impossible de charger les évaluations.' },
  )

  const { entries: historyEntries, isLoading: isLoadingHistory, error: historyError } =
    useEvaluationAttemptHistory()

  const {
    items: myEvaluations,
    isLoading: isLoadingMyEvaluations,
    error: myEvaluationsError,
    refetch: refetchMyEvaluations,
  } = useMyEvaluations()

  const {
    items: pendingValidationEvaluations,
    isLoading: isLoadingValidationQueue,
    error: validationQueueError,
    decide: decideValidationQueue,
  } = useEvaluationValidationQueue(canValidateEvaluation)

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
        <PageHeader
          title="Évaluations"
          subtitle="Des suites d'exercices chronométrées, corrigées par un professeur sur demande."
        />

        <EvaluationCreationSection
          canCreateEvaluation={canCreateEvaluation}
          onOpenCreateForm={() => setJustCreatedEvaluation(null)}
          onEvaluationCreated={(created) => setJustCreatedEvaluation(created)}
          onListsChanged={() => {
            refetch()
            refetchMyEvaluations()
          }}
        />

        {justCreatedEvaluation && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
            <p className="text-sm text-green-800">
              Évaluation « {getEvaluationDisplayTitle(justCreatedEvaluation.title)} » créée avec
              succès.
            </p>
            <button
              type="button"
              onClick={() => setJustCreatedEvaluation(null)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Fermer
            </button>
          </div>
        )}

        <Tabs
          ariaLabel="Sections Évaluations"
          tabs={[
            { id: 'catalog', label: 'Catalogue' },
            ...(canPassEvaluation ? [{ id: 'history', label: 'Mon historique' }] : []),
            ...(canCreateEvaluation ? [{ id: 'mine', label: 'Mes Évaluations' }] : []),
            ...(canValidateEvaluation ? [{ id: 'validation', label: 'Validation' }] : []),
            ...(canCorrectEvaluation ? [{ id: 'corrections', label: 'Corrections' }] : []),
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as EvaluationTab)}
        />

        <TabPanel tabId="catalog" activeTab={activeTab}>
          <EvaluationSearchCatalog
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
          />
        </TabPanel>

        {canPassEvaluation && (
          <TabPanel tabId="history" activeTab={activeTab}>
            {isLoadingHistory && <p className="text-gray-400 text-sm">Chargement de l'historique…</p>}
            {historyError && <ErrorMessage message={historyError} />}
            {!isLoadingHistory && !historyError && (
              <EvaluationAttemptHistoryList entries={historyEntries} />
            )}
          </TabPanel>
        )}

        {canCreateEvaluation && (
          <TabPanel tabId="mine" activeTab={activeTab}>
            {isLoadingMyEvaluations && (
              <p className="text-gray-400 text-sm">Chargement de vos évaluations…</p>
            )}
            {myEvaluationsError && <ErrorMessage message={myEvaluationsError} />}
            {!isLoadingMyEvaluations && !myEvaluationsError && (
              <MyEvaluationsList
                evaluations={myEvaluations}
                onResubmitted={() => refetchMyEvaluations()}
              />
            )}
          </TabPanel>
        )}

        {canValidateEvaluation && (
          <TabPanel tabId="validation" activeTab={activeTab}>
            <p className="text-sm text-gray-500 mb-3">
              Évaluations créées par un professeur, en attente de votre validation.
            </p>
            {isLoadingValidationQueue && (
              <p className="text-gray-400 text-sm">Chargement des évaluations en attente…</p>
            )}
            {validationQueueError && <ErrorMessage message={validationQueueError} />}
            {!isLoadingValidationQueue && !validationQueueError && (
              <EvaluationValidationList
                evaluations={pendingValidationEvaluations}
                onDecide={decideValidationQueue}
              />
            )}
          </TabPanel>
        )}

        {canCorrectEvaluation && (
          <TabPanel tabId="corrections" activeTab={activeTab}>
            <EvaluationCorrectionsTab canDecline={hasRole('formateur')} />
          </TabPanel>
        )}
      </div>
    </Layout>
  )
}
