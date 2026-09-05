/**
 * useContactRequests — demandes de contact reçues (à accepter/refuser) et envoyées
 * (lecture seule, tous statuts). Une demande traitée sort de la liste des demandes
 * en attente (docs/architecture/contacts-messagerie.md, points 2-3).
 */

import { useCallback, useState } from 'react'
import {
  acceptContactRequest,
  declineContactRequest,
  fetchIncomingContactRequests,
  fetchOutgoingContactRequests,
} from '../../api/contacts'
import type { ContactRequest } from '../../api/contacts'
import { getErrorMessage } from '../../utils/apiError'
import { useAsyncData } from '../useAsyncData'

export interface UseContactRequestsResult {
  incoming: ContactRequest[]
  outgoing: ContactRequest[]
  isLoading: boolean
  error: string | null
  /** Ajoute une demande fraîchement envoyée à la liste sortante sans re-fetch. */
  addOutgoingRequest: (request: ContactRequest) => void
  acceptRequest: (requestId: string) => Promise<boolean>
  declineRequest: (requestId: string) => Promise<boolean>
  pendingRequestId: string | null
  actionError: string | null
}

async function loadRequests(): Promise<{ incoming: ContactRequest[]; outgoing: ContactRequest[] }> {
  const [incoming, outgoing] = await Promise.all([
    fetchIncomingContactRequests(),
    fetchOutgoingContactRequests(),
  ])
  return { incoming, outgoing }
}

export function useContactRequests(): UseContactRequestsResult {
  const { data, isLoading, error } = useAsyncData(loadRequests, [], {
    fallbackErrorMessage: 'Impossible de charger les demandes de contact.',
  })

  const [incomingOverride, setIncomingOverride] = useState<ContactRequest[] | null>(null)
  const [outgoingOverride, setOutgoingOverride] = useState<ContactRequest[] | null>(null)

  const incoming = incomingOverride ?? data?.incoming ?? []
  const outgoing = outgoingOverride ?? data?.outgoing ?? []

  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const addOutgoingRequest = useCallback(
    (request: ContactRequest) => {
      setOutgoingOverride((previous) => [request, ...(previous ?? data?.outgoing ?? [])])
    },
    [data],
  )

  const respond = useCallback(
    async (
      requestId: string,
      action: (id: string) => Promise<ContactRequest>,
      fallbackErrorMessage: string,
    ): Promise<boolean> => {
      setPendingRequestId(requestId)
      setActionError(null)
      try {
        await action(requestId)
        setIncomingOverride((previous) =>
          (previous ?? data?.incoming ?? []).filter((request) => request.id !== requestId),
        )
        return true
      } catch (caughtError: unknown) {
        setActionError(getErrorMessage(caughtError, fallbackErrorMessage))
        return false
      } finally {
        setPendingRequestId(null)
      }
    },
    [data],
  )

  const acceptRequest = useCallback(
    (requestId: string) => respond(requestId, acceptContactRequest, "Impossible d'accepter cette demande."),
    [respond],
  )

  const declineRequest = useCallback(
    (requestId: string) => respond(requestId, declineContactRequest, 'Impossible de refuser cette demande.'),
    [respond],
  )

  return {
    incoming,
    outgoing,
    isLoading,
    error,
    addOutgoingRequest,
    acceptRequest,
    declineRequest,
    pendingRequestId,
    actionError,
  }
}
