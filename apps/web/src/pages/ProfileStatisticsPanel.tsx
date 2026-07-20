import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { useProfileStatistics } from '../hooks/profile/useProfileStatistics'

interface Props {
  userId: string
}

/**
 * Panneau de statistiques pédagogiques d'un utilisateur.
 * Visible pour l'utilisateur lui-même, les formateurs liés, les parents et les rôles internes.
 */
export default function ProfileStatisticsPanel({ userId }: Props) {
  const { user, hasRole } = useAuth()

  const isViewingOwnProfile = user?.id === userId
  const canViewStatistics =
    isViewingOwnProfile ||
    hasRole(
      'formateur',
      'parent_financeur',
      'responsable_pedagogique',
      'animateur_pedagogique',
      'technicien_informatique',
      'administrateur_financier',
    )

  const { statistics, isLoading, hasError } = useProfileStatistics(userId, canViewStatistics)

  if (!canViewStatistics) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Statistiques pédagogiques</h2>

      {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

      {hasError && (
        <p className="text-gray-400 text-sm">Statistiques non disponibles pour le moment</p>
      )}

      {!isLoading && !hasError && statistics && (() => {
        const hasAnyValue =
          statistics.totalSessionsAttended !== undefined ||
          statistics.totalHoursLearned !== undefined ||
          statistics.averageSessionDurationMinutes !== undefined ||
          statistics.lastSessionDate !== undefined ||
          statistics.currentLevel !== undefined ||
          statistics.progressScore !== undefined ||
          (statistics.subjectsStudied !== undefined && statistics.subjectsStudied.length > 0)

        if (!hasAnyValue) {
          return <p className="text-gray-400 text-sm">Aucune statistique disponible</p>
        }

        return (
          <dl className="space-y-3">
            {statistics.totalSessionsAttended !== undefined && (
              <StatItem
                label="Séances suivies"
                value={String(statistics.totalSessionsAttended)}
              />
            )}
            {statistics.totalHoursLearned !== undefined && (
              <StatItem
                label="Heures d'apprentissage"
                value={`${statistics.totalHoursLearned}h`}
              />
            )}
            {statistics.averageSessionDurationMinutes !== undefined && (
              <StatItem
                label="Durée moyenne par séance"
                value={`${statistics.averageSessionDurationMinutes} min`}
              />
            )}
            {statistics.lastSessionDate && (
              <StatItem
                label="Dernière séance"
                value={new Date(statistics.lastSessionDate).toLocaleDateString('fr-FR')}
              />
            )}
            {statistics.currentLevel && (
              <StatItem label="Niveau actuel" value={statistics.currentLevel} />
            )}
            {statistics.progressScore !== undefined && (
              <StatItem
                label="Score de progression"
                value={`${statistics.progressScore} / 100`}
              />
            )}
            {statistics.subjectsStudied && statistics.subjectsStudied.length > 0 && (
              <StatItem
                label="Matières étudiées"
                value={statistics.subjectsStudied.join(', ')}
              />
            )}
          </dl>
        )
      })()}

      {!isLoading && !hasError && !statistics && (
        <p className="text-gray-400 text-sm">Aucune statistique disponible</p>
      )}
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="text-sm font-medium text-gray-500 w-48 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-800 flex-1">{value}</dd>
    </div>
  )
}
