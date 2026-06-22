/**
 * ContentValidationQueuePage — Phase 12 (content-catalog-service)
 *
 * Page de validation du catalogue pédagogique pour les rôles RP et AP.
 * Charge les contenus en statut `pending_validation` et permet de les valider ou rejeter.
 *
 * Routes API consommées :
 *   GET /exercises   (filtrés par status=pending_validation)
 *   GET /evaluations (filtrés par status=pending_validation)
 *   GET /tutorials   (filtrés par status=pending_validation)
 */

import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import ContentValidationQueue from '../components/content-catalog/ContentValidationQueue'
import {
  fetchExercises,
  fetchEvaluations,
  fetchTutorials,
  type Exercise,
  type Evaluation,
  type Tutorial,
} from '../api/contentCatalog'

export default function ContentValidationQueuePage() {
  const { hasRole } = useAuth()

  const [pendingExercises, setPendingExercises] = useState<Exercise[]>([])
  const [pendingEvaluations, setPendingEvaluations] = useState<Evaluation[]>([])
  const [pendingTutorials, setPendingTutorials] = useState<Tutorial[]>([])
  const [isLoadingContent, setIsLoadingContent] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [validationFeedback, setValidationFeedback] = useState<string | null>(null)

  const canValidateContent = hasRole('responsable_pedagogique', 'animateur_pedagogique')

  useEffect(() => {
    if (!canValidateContent) {
      setIsLoadingContent(false)
      return
    }

    setIsLoadingContent(true)
    setLoadError(null)

    Promise.all([
      fetchExercises({ status: 'pending_validation' }),
      fetchEvaluations({ status: 'pending_validation' }),
      fetchTutorials({ status: 'pending_validation' }),
    ])
      .then(([exercises, evaluations, tutorials]) => {
        setPendingExercises(exercises)
        setPendingEvaluations(evaluations)
        setPendingTutorials(tutorials)
      })
      .catch(() => setLoadError('Impossible de charger les contenus en attente.'))
      .finally(() => setIsLoadingContent(false))
  }, [canValidateContent])

  const handleValidateContent = (
    contentType: 'exercise' | 'evaluation' | 'tutorial',
    contentId: string,
    decision: 'approve' | 'reject',
  ) => {
    // Mise à jour optimiste locale — la route de validation n'est pas encore spécifiée
    // dans la phase 12. Le feedback est affiché et l'item retiré de la liste.
    if (contentType === 'exercise') {
      setPendingExercises((previous) => previous.filter((item) => item.id !== contentId))
    } else if (contentType === 'evaluation') {
      setPendingEvaluations((previous) => previous.filter((item) => item.id !== contentId))
    } else {
      setPendingTutorials((previous) => previous.filter((item) => item.id !== contentId))
    }

    const decisionLabel = decision === 'approve' ? 'validé' : 'rejeté'
    setValidationFeedback(`Contenu ${decisionLabel} avec succès.`)
    setTimeout(() => setValidationFeedback(null), 3000)
  }

  if (!canValidateContent) {
    return (
      <Layout>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Validation des contenus</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-700 text-sm">
              Accès réservé aux Responsables Pédagogiques et Animateurs Pédagogiques.
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  if (isLoadingContent) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement des contenus en attente…</p>
      </Layout>
    )
  }

  if (loadError) {
    return (
      <Layout>
        <p className="text-red-600">{loadError}</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Validation des contenus</h1>
          <p className="text-gray-500 text-sm mt-1">
            Contenus pédagogiques soumis en attente de votre validation.
          </p>
        </div>

        {/* Feedback de validation */}
        {validationFeedback && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <p className="text-green-700 text-sm">{validationFeedback}</p>
          </div>
        )}

        <ContentValidationQueue
          pendingExercises={pendingExercises}
          pendingEvaluations={pendingEvaluations}
          pendingTutorials={pendingTutorials}
          onValidateContent={handleValidateContent}
        />
      </div>
    </Layout>
  )
}
