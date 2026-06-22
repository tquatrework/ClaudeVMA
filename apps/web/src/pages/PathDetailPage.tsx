/**
 * PathDetailPage — Phase 14 (community-path-service)
 *
 * Détail d'un parcours pédagogique.
 * - L'élève peut s'inscrire (max 3 parcours actifs).
 * - Le RP peut valider ou rejeter le parcours.
 * - Affiche la progression si l'élève est inscrit.
 *
 * Routes API consommées :
 *   POST /paths/:id/validate
 *   POST /paths/:id/enrollments
 */

import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { enrollInPath, validatePath, type PathEnrollment } from '../api/communityPath'

const MAX_ACTIVE_PATHS = 3

export default function PathDetailPage() {
  const { pathId } = useParams<{ pathId: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  const [enrollment, setEnrollment] = useState<PathEnrollment | null>(null)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [activeEnrollmentCount, setActiveEnrollmentCount] = useState(0)

  const [isValidating, setIsValidating] = useState(false)
  const [validationComment, setValidationComment] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null)

  const isStudent = hasRole('eleve')
  const isRp = hasRole('responsable_pedagogique')

  const hasReachedPathLimit = activeEnrollmentCount >= MAX_ACTIVE_PATHS

  const handleEnroll = async () => {
    if (!pathId) return
    if (hasReachedPathLimit) {
      setEnrollError(
        `Vous ne pouvez pas vous inscrire à plus de ${MAX_ACTIVE_PATHS} parcours actifs simultanément.`,
      )
      return
    }

    setIsEnrolling(true)
    setEnrollError(null)

    try {
      const newEnrollment = await enrollInPath(pathId)
      setEnrollment(newEnrollment)
      setActiveEnrollmentCount((count) => count + 1)
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setEnrollError("Vous n'êtes pas autorisé à vous inscrire à ce parcours.")
      } else if (responseStatus === 409) {
        setEnrollError('Vous êtes déjà inscrit à ce parcours.')
      } else {
        setEnrollError("Impossible de vous inscrire au parcours.")
      }
    } finally {
      setIsEnrolling(false)
    }
  }

  const handleValidate = async (approved: boolean) => {
    if (!pathId) return
    setIsValidating(true)
    setValidationError(null)
    setValidationSuccess(null)

    try {
      await validatePath(pathId, {
        approved,
        comment: validationComment.trim() || undefined,
      })
      setValidationSuccess(
        approved ? 'Le parcours a été validé et publié.' : 'Le parcours a été rejeté.',
      )
      setValidationComment('')
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setValidationError("Vous n'êtes pas autorisé à valider ce parcours.")
      } else {
        setValidationError('Impossible de valider le parcours.')
      }
    } finally {
      setIsValidating(false)
    }
  }

  if (!pathId) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">Identifiant du parcours manquant.</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Navigation retour */}
        <button
          type="button"
          onClick={() => navigate('/community/paths')}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Retour aux parcours
        </button>

        <h1 className="text-2xl font-bold text-gray-900">Détail du parcours</h1>

        {/* Inscription élève */}
        {isStudent && !enrollment && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-3">
            <p className="text-sm text-indigo-800">
              Inscrivez-vous à ce parcours pour commencer votre progression.
            </p>
            {hasReachedPathLimit && (
              <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-md px-3 py-2">
                Vous avez atteint la limite de {MAX_ACTIVE_PATHS} parcours actifs. Terminez ou
                annulez un parcours pour pouvoir vous inscrire.
              </p>
            )}
            {enrollError && <p className="text-red-600 text-sm">{enrollError}</p>}
            <button
              type="button"
              onClick={handleEnroll}
              disabled={isEnrolling || hasReachedPathLimit}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isEnrolling ? 'Inscription…' : "S'inscrire au parcours"}
            </button>
          </div>
        )}

        {/* Progression élève inscrit */}
        {isStudent && enrollment && (
          <PathEnrollmentProgress enrollment={enrollment} />
        )}

        {/* Validation RP */}
        {isRp && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Validation du parcours</h2>

            <div>
              <label htmlFor="validation-comment" className="block text-sm text-gray-700 mb-1">
                Commentaire (optionnel)
              </label>
              <textarea
                id="validation-comment"
                rows={3}
                value={validationComment}
                onChange={(e) => setValidationComment(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                disabled={isValidating}
                placeholder="Motif d'approbation ou de rejet…"
              />
            </div>

            {validationError && <p className="text-red-600 text-sm">{validationError}</p>}
            {validationSuccess && <p className="text-green-600 text-sm">{validationSuccess}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleValidate(true)}
                disabled={isValidating}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isValidating ? 'En cours…' : 'Valider le parcours'}
              </button>
              <button
                type="button"
                onClick={() => handleValidate(false)}
                disabled={isValidating}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isValidating ? 'En cours…' : 'Rejeter le parcours'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

// ─── Sous-composant : progression d'inscription ───────────────────────────────

interface PathEnrollmentProgressProps {
  enrollment: PathEnrollment
}

export function PathEnrollmentProgress({ enrollment }: PathEnrollmentProgressProps) {
  const isCompleted = enrollment.status === 'completed'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h2 className="text-base font-semibold text-gray-800">Votre progression</h2>

      {/* Barre de progression */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progression</span>
          <span>{enrollment.progressPercent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              isCompleted ? 'bg-green-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${enrollment.progressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`text-xs px-2 py-0.5 rounded font-medium ${
            isCompleted
              ? 'bg-green-100 text-green-700'
              : enrollment.status === 'cancelled'
                ? 'bg-red-100 text-red-600'
                : 'bg-indigo-100 text-indigo-700'
          }`}
        >
          {isCompleted ? 'Terminé' : enrollment.status === 'cancelled' ? 'Annulé' : 'En cours'}
        </span>
        <span className="text-xs text-gray-400">
          Inscrit le {new Date(enrollment.enrolledAt).toLocaleDateString('fr-FR')}
        </span>
      </div>

      {/* Certificat si terminé */}
      {isCompleted && (
        <CertificateView enrollment={enrollment} />
      )}
    </div>
  )
}

// ─── Sous-composant : certificat de complétion ────────────────────────────────

interface CertificateViewProps {
  enrollment: PathEnrollment
}

export function CertificateView({ enrollment }: CertificateViewProps) {
  const isCompleted = enrollment.status === 'completed'

  if (!isCompleted) return null

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-green-600 font-bold text-lg">Certificat de complétion</span>
      </div>
      <p className="text-sm text-green-700">
        Félicitations ! Vous avez complété ce parcours le{' '}
        {enrollment.completedAt
          ? new Date(enrollment.completedAt).toLocaleDateString('fr-FR')
          : 'date inconnue'}
        .
      </p>
      {enrollment.certificateUrl ? (
        <a
          href={enrollment.certificateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
        >
          Télécharger le certificat
        </a>
      ) : (
        <p className="text-xs text-green-600 italic">
          Le certificat est en cours de génération.
        </p>
      )}
    </div>
  )
}
