/**
 * ContactRequestsPanel — demandes de contact reçues (accepter/refuser) et envoyées
 * (lecture seule). Une demande traitée sort de la liste des demandes reçues
 * (docs/architecture/contacts-messagerie.md, points 2-3).
 */

import React from 'react'
import type { ContactRequest } from '../../api/contacts'
import { formatFullName } from '../../utils/nameFormat'
import { formatLocalDate } from '../../utils/dateFormat'
import { ErrorMessage } from '../ui/ErrorMessage'
import { EmptyState } from '../ui/EmptyState'
import { useContactRequests } from '../../hooks/communication/useContactRequests'

function requestDisplayName(request: ContactRequest): string {
  return formatFullName(request.counterpartName?.firstName, request.counterpartName?.lastName) || 'Nom non renseigné'
}

const OUTGOING_STATUS_LABEL: Record<ContactRequest['status'], string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  declined: 'Refusée',
}

export function ContactRequestsPanel() {
  const { incoming, outgoing, isLoading, error, acceptRequest, declineRequest, pendingRequestId, actionError } =
    useContactRequests()

  if (isLoading) {
    return <p className="py-8 text-center text-gray-400 text-sm">Chargement des demandes…</p>
  }

  if (error) {
    return <ErrorMessage message={error} />
  }

  return (
    <div className="space-y-8">
      {actionError && <ErrorMessage message={actionError} />}

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Demandes reçues
        </h2>
        {incoming.length === 0 ? (
          <EmptyState message="Aucune demande de contact en attente." />
        ) : (
          <ul className="space-y-2">
            {incoming.map((request) => (
              <li
                key={request.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {requestDisplayName(request)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Reçue le {formatLocalDate(request.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => acceptRequest(request.id)}
                    disabled={pendingRequestId === request.id}
                    className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {pendingRequestId === request.id ? '…' : 'Accepter'}
                  </button>
                  <button
                    onClick={() => declineRequest(request.id)}
                    disabled={pendingRequestId === request.id}
                    className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50 whitespace-nowrap"
                  >
                    {pendingRequestId === request.id ? '…' : 'Refuser'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Demandes envoyées
        </h2>
        {outgoing.length === 0 ? (
          <EmptyState message="Vous n'avez envoyé aucune demande de contact." />
        ) : (
          <ul className="space-y-2">
            {outgoing.map((request) => (
              <li
                key={request.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {requestDisplayName(request)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Envoyée le {formatLocalDate(request.createdAt)}
                  </p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {OUTGOING_STATUS_LABEL[request.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
