/**
 * TeacherValidationQueuePage — `/rp/teacher-validations`, file de validation des
 * nouveaux formateurs.
 *
 * Première des deux files de travail du RP (arbitrage du 2026-08-12). Jusqu'ici
 * la validation n'était atteignable que depuis la fiche d'un formateur
 * (`TeacherValidationPanel` monté dans `ProfilePage`) : le RP ne pouvait agir que
 * sur quelqu'un qu'il connaissait déjà, ce qui suppose résolu le problème que
 * l'écran devrait résoudre.
 *
 * Chargement au niveau de la page, un seul appel par page de file. Une décision
 * ne relance rien : la réponse du serveur remonte au hook propriétaire de l'état
 * et la ligne quitte la file sur place (arbitrage du 2026-08-10).
 */

import React from 'react'
import Layout from '../components/Layout'
import PendingTeacherCard from '../components/teacher-requests/PendingTeacherCard'
import RpWorkQueueNav from '../components/teacher-requests/RpWorkQueueNav'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { PageHeader } from '../components/ui/PageHeader'
import { usePendingTeacherValidations } from '../hooks/teacher-requests/usePendingTeacherValidations'

const QUEUE_PATH = '/rp/teacher-validations'

export default function TeacherValidationQueuePage() {
  const {
    teachers,
    isLoading,
    loadError,
    totalPending,
    page,
    totalPages,
    goToPage,
    applyDecision,
  } = usePendingTeacherValidations()

  const hasPagination = totalPages > 1

  return (
    <Layout>
      <div className="max-w-3xl space-y-6">
        <PageHeader
          title="Nouveaux formateurs"
          subtitle="Formateurs inscrits en attente d'examen, du plus ancien au plus récent."
          action={
            <span className="text-sm text-gray-500">
              {isLoading ? '…' : `${totalPending} dossier${totalPending > 1 ? 's' : ''} en attente`}
            </span>
          }
        />

        <RpWorkQueueNav currentPath={QUEUE_PATH} />

        {loadError && <ErrorMessage message={loadError} />}

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {!isLoading && !loadError && teachers.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-500 text-sm font-medium">
              Aucun formateur en attente d'examen.
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Les nouvelles inscriptions apparaîtront ici.
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {teachers.map((teacher) => (
            <li key={teacher.userId}>
              <PendingTeacherCard teacher={teacher} onDecision={applyDecision} />
            </li>
          ))}
        </ul>

        {hasPagination && (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || isLoading}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 disabled:opacity-40"
            >
              Page précédente
            </button>
            <span className="text-xs text-gray-500">
              Page {page} sur {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 disabled:opacity-40"
            >
              Page suivante
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
