/**
 * QuizEditPage — édition d'un Quizz par son auteur.
 *
 * Retour post-production du 2026-08-28 (`docs/architecture.md` > « Edition d'un Quizz par son
 * auteur ») : aucune route d'édition n'existait, aucun écran ne permettait à un professeur de
 * retrouver et corriger son propre Quizz.
 *
 * Suite directe (PR #167 content-catalog-service, mergée et déployée) : le formulaire charge
 * désormais le détail **avec solution** (`GET /quizzes/:id/solution`, réservé à l'auteur et aux
 * AP/RP/TI), et pré-remplit réellement les bonnes réponses cochées et les mots-clés déjà saisis
 * — voir `buildEditableStateForEdit` dans `quizPayload.ts`. Vérifié en HTTP direct contre la
 * pile réelle le 2026-08-28.
 *
 * Routes API consommées :
 *   GET /quizzes/:id/solution  (content-catalog-service — réservée à l'auteur et aux AP/RP/TI)
 *   PUT /quizzes/:id           (content-catalog-service — confirmé, même DTO que la création)
 */

import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchQuizSolution } from '../api/quizzes'
import { buildEditableStateForEdit } from '../utils/quizPayload'
import { QuizForm } from '../components/content-catalog/QuizForm'

export default function QuizEditPage() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const resolvedQuizId = quizId ?? ''

  const {
    data: quiz,
    isLoading,
    error: loadError,
  } = useAsyncData(() => fetchQuizSolution(resolvedQuizId), [resolvedQuizId], {
    fallbackErrorMessage: 'Impossible de charger ce quizz pour modification.',
  })

  if (!resolvedQuizId) {
    return (
      <Layout>
        <ErrorMessage message="Quizz introuvable." />
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement du quizz…</p>
      </Layout>
    )
  }

  if (loadError || !quiz) {
    return (
      <Layout>
        <ErrorMessage
          message={
            loadError ?? "Ce quizz est introuvable ou vous n'êtes pas autorisé à le modifier."
          }
        />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/content/quizz')}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          ← Retour au catalogue
        </button>

        <PageHeader title="Modifier le Quizz" subtitle={quiz.title} />

        <QuizForm
          mode="edit"
          quizId={resolvedQuizId}
          initialState={buildEditableStateForEdit(quiz)}
          onSaved={(saved) => navigate(`/content/quizz/${saved.id}`)}
          onCancel={() => navigate(`/content/quizz/${resolvedQuizId}`)}
        />
      </div>
    </Layout>
  )
}
