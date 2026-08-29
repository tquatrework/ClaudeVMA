/**
 * QuizzPage — catalogue des Quizz.
 *
 * Recherche par tag/mot-clé, pagination, ouverture d'un quizz pour le passer, création
 * (formateur/AP/RP), historique personnel des tentatives passées, onglet « Mes Quizz » pour
 * retrouver/modifier/resoumettre ses propres créations (2026-08-28,
 * `docs/architecture.md` > « Edition d'un Quizz par son auteur »), et — demande du 2026-08-29 —
 * onglet « Validation » pour que RP/AP valident ou rejettent directement depuis la page Quizz,
 * sans redescendre vers l'écran générique « Contenus à valider ». Réutilise le même composant
 * (`QuizValidationList`) et les mêmes routes que cet écran générique ; le scoping AP par relation
 * `animator_of_teacher` est déjà appliqué côté serveur, non dupliqué ici.
 *
 * Fonctionnalité branchée sur la pile réelle le 2026-08-28 (`content-catalog-service` PR #152,
 * `learning-activity-service` PR #151) — remplace l'état « à venir » précédent.
 *
 * Routes API consommées :
 *   GET  /quizzes                     (content-catalog-service — recherche, et « mes Quizz » via `mine=true`)
 *   GET  /quizzes/pending-validation  (content-catalog-service — file de validation RP/AP)
 *   POST /quizzes                     (content-catalog-service — création)
 *   POST /validations/quiz/:id/decision (content-catalog-service — décision de validation)
 *   GET  /quiz-attempts/history       (learning-activity-service — historique)
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useAsyncData } from '../hooks/useAsyncData'
import { useQuizAttemptHistory } from '../hooks/learning-activity/useQuizAttemptHistory'
import { useMyQuizzes } from '../hooks/content-catalog/useMyQuizzes'
import { useQuizValidationQueue } from '../hooks/content-catalog/useQuizValidationQueue'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { StatusBadge } from '../components/ui/StatusBadge'
import { CatalogItemCard } from '../components/ui/CatalogItemCard'
import { Tabs, TabPanel } from '../components/ui/Tabs'
import { QuizCreationSection } from '../components/content-catalog/QuizCreationSection'
import { QuizAttemptHistoryList } from '../components/learning-activity/QuizAttemptHistoryList'
import { MyQuizzesList } from '../components/content-catalog/MyQuizzesList'
import { QuizValidationList } from '../components/content-catalog/QuizValidationList'
import { searchQuizzes } from '../api/quizzes'
import { QUIZ_STATUS_BADGE_CLASSES, QUIZ_STATUS_LABELS } from '../utils/quizLabels'
import type { PublicQuizDetail } from '../types/quiz'

const PAGE_SIZE = 20

export default function QuizzPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'catalog' | 'history' | 'mine' | 'validation'>(
    'catalog',
  )
  const [tagFilter, setTagFilter] = useState('')
  const [keywordFilter, setKeywordFilter] = useState('')
  const [appliedTag, setAppliedTag] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [justCreatedQuiz, setJustCreatedQuiz] = useState<PublicQuizDetail | null>(null)

  const canCreateQuiz = hasRole('formateur', 'animateur_pedagogique', 'responsable_pedagogique')
  const canValidateQuiz = hasRole('responsable_pedagogique', 'animateur_pedagogique')

  const {
    data: searchResult,
    isLoading,
    error: loadError,
    refetch,
  } = useAsyncData(
    () => searchQuizzes({ tag: appliedTag || undefined, keyword: appliedKeyword || undefined, page, limit: PAGE_SIZE }),
    [appliedTag, appliedKeyword, page],
    { fallbackErrorMessage: 'Impossible de charger les quizz.' },
  )

  const { entries: historyEntries, isLoading: isLoadingHistory, error: historyError } =
    useQuizAttemptHistory()

  const {
    items: myQuizzes,
    isLoading: isLoadingMyQuizzes,
    error: myQuizzesError,
    refetch: refetchMyQuizzes,
  } = useMyQuizzes()

  const {
    items: pendingValidationQuizzes,
    isLoading: isLoadingValidationQueue,
    error: validationQueueError,
    decide: decideValidationQueue,
  } = useQuizValidationQueue(canValidateQuiz)

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
        <PageHeader title="Quizz" subtitle="Des quiz rapides pour réviser en s'amusant." />

        <QuizCreationSection
          canCreateQuiz={canCreateQuiz}
          onOpenCreateForm={() => setJustCreatedQuiz(null)}
          onQuizCreated={(createdQuiz) => setJustCreatedQuiz(createdQuiz)}
          onListsChanged={() => {
            refetch()
            refetchMyQuizzes()
          }}
        />

        {justCreatedQuiz && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
            <p className="text-sm text-green-800">
              Quizz « {justCreatedQuiz.title} » créé avec succès. Que souhaitez-vous faire ?
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  navigate(`/content/quizz/${justCreatedQuiz.id}`, { state: { autoStart: true } })
                }
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
              >
                Commencer le Quizz
              </button>
              <button
                type="button"
                onClick={() => navigate(`/content/quizz/${justCreatedQuiz.id}/edit`)}
                className="px-4 py-2 text-sm font-medium text-indigo-700 bg-white border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors"
              >
                Modifier le Quizz
              </button>
              <button
                type="button"
                onClick={() => setJustCreatedQuiz(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        <Tabs
          ariaLabel="Sections Quizz"
          tabs={[
            { id: 'catalog', label: 'Catalogue' },
            { id: 'history', label: 'Mon historique' },
            ...(canCreateQuiz ? [{ id: 'mine', label: 'Mes Quizz' }] : []),
            ...(canValidateQuiz ? [{ id: 'validation', label: 'Validation' }] : []),
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as 'catalog' | 'history' | 'mine' | 'validation')}
        />

        <TabPanel tabId="catalog" activeTab={activeTab}>
          <div className="space-y-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-3 items-end">
              <div>
                <label htmlFor="quiz-search-tag" className="block text-xs text-gray-600 mb-1">
                  Tag
                </label>
                <input
                  id="quiz-search-tag"
                  type="text"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  placeholder="fractions"
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="quiz-search-keyword" className="block text-xs text-gray-600 mb-1">
                  Mot-clé (titre)
                </label>
                <input
                  id="quiz-search-keyword"
                  type="text"
                  value={keywordFilter}
                  onChange={(e) => setKeywordFilter(e.target.value)}
                  placeholder="géométrie"
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800 transition-colors"
              >
                Rechercher
              </button>
            </form>

            {isLoading && <p className="text-gray-400 text-sm">Chargement des quizz…</p>}
            {loadError && <ErrorMessage message={loadError} />}

            {!isLoading && !loadError && searchResult && (
              <>
                {searchResult.items.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                    <EmptyState message="Aucun quizz ne correspond à cette recherche." />
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {searchResult.items.map((quiz) => (
                      <CatalogItemCard
                        key={quiz.id}
                        id={quiz.id}
                        title={quiz.title}
                        description={quiz.description}
                        tags={quiz.tags.map((tag) => ({ label: tag }))}
                        rightBadge={
                          quiz.status !== 'validated' ? (
                            <StatusBadge
                              status={quiz.status}
                              label={QUIZ_STATUS_LABELS[quiz.status]}
                              badgeClasses={QUIZ_STATUS_BADGE_CLASSES}
                            />
                          ) : undefined
                        }
                        onSelect={(id) => navigate(`/content/quizz/${id}`)}
                      />
                    ))}
                  </ul>
                )}

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1 text-sm text-gray-600 disabled:opacity-40"
                    >
                      Précédent
                    </button>
                    <span className="text-sm text-gray-500">
                      Page {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="px-3 py-1 text-sm text-gray-600 disabled:opacity-40"
                    >
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </TabPanel>

        <TabPanel tabId="history" activeTab={activeTab}>
          {isLoadingHistory && <p className="text-gray-400 text-sm">Chargement de l'historique…</p>}
          {historyError && <ErrorMessage message={historyError} />}
          {!isLoadingHistory && !historyError && (
            <QuizAttemptHistoryList entries={historyEntries} />
          )}
        </TabPanel>

        {canCreateQuiz && (
          <TabPanel tabId="mine" activeTab={activeTab}>
            {isLoadingMyQuizzes && <p className="text-gray-400 text-sm">Chargement de vos quizz…</p>}
            {myQuizzesError && <ErrorMessage message={myQuizzesError} />}
            {!isLoadingMyQuizzes && !myQuizzesError && (
              <MyQuizzesList quizzes={myQuizzes} onResubmitted={() => refetchMyQuizzes()} />
            )}
          </TabPanel>
        )}

        {canValidateQuiz && (
          <TabPanel tabId="validation" activeTab={activeTab}>
            <p className="text-sm text-gray-500 mb-3">
              Quizz créés par un professeur, en attente de votre validation.
            </p>
            {isLoadingValidationQueue && (
              <p className="text-gray-400 text-sm">Chargement des quizz en attente…</p>
            )}
            {validationQueueError && <ErrorMessage message={validationQueueError} />}
            {!isLoadingValidationQueue && !validationQueueError && (
              <QuizValidationList
                quizzes={pendingValidationQuizzes}
                onDecide={decideValidationQueue}
              />
            )}
          </TabPanel>
        )}
      </div>
    </Layout>
  )
}
