/**
 * QuizEditPage — édition d'un Quizz par son auteur.
 *
 * Retour post-production du 2026-08-28 (`docs/architecture.md` > « Edition d'un Quizz par son
 * auteur ») : aucune route d'édition n'existait, aucun écran ne permettait à un professeur de
 * retrouver et corriger son propre Quizz.
 *
 * **Vérifié en HTTP direct contre la pile réelle le 2026-08-28** : `content-catalog-service` ne
 * renvoie jamais la solution (bonnes réponses, mots-clés) à l'auteur, sur aucune route — ni
 * `GET /quizzes/:id/edit` (n'existe pas), ni un paramètre sur la route publique. Le formulaire
 * charge donc le détail **public** (même route que la lecture normale) et l'auteur doit
 * **ressaisir la solution** avant d'enregistrer — voir le bandeau d'avertissement ci-dessous et
 * `buildEditableStateForEdit` dans `quizPayload.ts`.
 *
 * Routes API consommées :
 *   GET /quizzes/:id  (content-catalog-service — lecture publique, sans la solution)
 *   PUT /quizzes/:id  (content-catalog-service — confirmé, même DTO que la création)
 */

import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchQuiz } from '../api/quizzes'
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
  } = useAsyncData(() => fetchQuiz(resolvedQuizId), [resolvedQuizId], {
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

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-sm text-amber-800">
            Pour des raisons de sécurité, les bonnes réponses et les mots-clés attendus ne sont
            jamais renvoyés au formulaire d'édition : merci de{' '}
            <strong>re-cocher la ou les bonnes réponses</strong> et de{' '}
            <strong>ressaisir les mots-clés attendus</strong> pour chaque question avant
            d'enregistrer.
          </p>
        </div>

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
