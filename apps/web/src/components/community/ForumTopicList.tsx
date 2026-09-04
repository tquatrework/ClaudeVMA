/**
 * ForumTopicList — liste paginée des sujets d'un forum (`GET /forums/:id/topics`).
 *
 * Un sujet non `validated` (visible uniquement à son auteur et aux administrateurs) porte un badge
 * de statut explicite — jamais présenté comme un sujet normal. Le sujet système « Sujet général »
 * apparaît toujours en premier (tri déjà fait côté serveur).
 */

import React from 'react'
import { ErrorMessage } from '../ui/ErrorMessage'
import { EmptyState } from '../ui/EmptyState'
import { CatalogItemCard } from '../ui/CatalogItemCard'
import { FORUM_LABELS, formatTopicStatusLabel } from '../../utils/forumLabels'
import type { ForumTopic } from '../../types/forum'

interface ForumTopicListProps {
  topics: ForumTopic[]
  isLoading: boolean
  loadError: string | null
  page: number
  totalPages: number
  onPageChange: (nextPage: number) => void
  onSelect: (topic: ForumTopic) => void
}

function statusBadgeClass(status: ForumTopic['status']): string {
  if (status === 'rejected') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

export function ForumTopicList({
  topics,
  isLoading,
  loadError,
  page,
  totalPages,
  onPageChange,
  onSelect,
}: ForumTopicListProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-gray-800">{FORUM_LABELS.topicsTitle}</h2>

      {isLoading && <p className="text-sm text-gray-400">Chargement des sujets…</p>}
      {loadError && <ErrorMessage message={loadError} />}

      {!isLoading && !loadError && topics.length === 0 && (
        <EmptyState message={FORUM_LABELS.emptyTopics} />
      )}

      {!isLoading && topics.length > 0 && (
        <ul className="space-y-3">
          {topics.map((topic) => {
            const statusLabel = formatTopicStatusLabel(topic.status)
            return (
              <CatalogItemCard
                key={topic.id}
                id={topic.id}
                title={topic.isDefault ? `📌 ${topic.title}` : topic.title}
                onSelect={() => onSelect(topic)}
                rightBadge={
                  statusLabel ? (
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${statusBadgeClass(topic.status)}`}
                    >
                      {statusLabel}
                    </span>
                  ) : undefined
                }
              />
            )
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 text-sm text-gray-600 border border-gray-200 rounded-md disabled:opacity-40"
          >
            Précédent
          </button>
          <span className="text-sm text-gray-500">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm text-gray-600 border border-gray-200 rounded-md disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  )
}
