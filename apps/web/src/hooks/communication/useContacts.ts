/**
 * useContacts — mes contacts ACTIFS (créés par défaut ou acceptés), et l'action
 * de rupture volontaire d'un contact.
 *
 * docs/architecture/contacts-messagerie.md (2026-09-04) : le Contact est une entité
 * propre à communication-service, distincte des relations métier de profile-service
 * consommées par `useMyContacts` (`GET /relations/my-contacts`) — ne pas confondre
 * les deux hooks, ils ne portent pas la même donnée.
 */

import { useCallback, useState } from 'react'
import { breakContact as breakContactRequest, fetchContacts } from '../../api/contacts'
import type { Contact } from '../../api/contacts'
import { formatFullName } from '../../utils/nameFormat'
import { getErrorMessage } from '../../utils/apiError'
import { useAsyncData } from '../useAsyncData'

const MISSING_NAME_LABEL = 'Contact (nom non renseigné)'

export function formatContactDisplayName(contact: Pick<Contact, 'counterpartName'>): string {
  if (!contact.counterpartName) return MISSING_NAME_LABEL
  return formatFullName(contact.counterpartName.firstName, contact.counterpartName.lastName) || MISSING_NAME_LABEL
}

export interface UseContactsResult {
  contacts: Contact[]
  isLoading: boolean
  error: string | null
  /** Rompt un contact actif ; renvoie `true` en cas de succès. */
  breakContact: (contactId: string) => Promise<boolean>
  breakingContactId: string | null
  breakError: string | null
}

export function useContacts(): UseContactsResult {
  // `refetch` volontairement non utilisé : la mise à jour locale après rupture suffit
  // (règle de chargement du 2026-08-10 — pas de re-fetch après une écriture).
  const { data, isLoading, error } = useAsyncData(fetchContacts, [], {
    fallbackErrorMessage: 'Impossible de charger vos contacts.',
  })

  const [contactsOverride, setContactsOverride] = useState<Contact[] | null>(null)
  const contacts = contactsOverride ?? data ?? []

  const [breakingContactId, setBreakingContactId] = useState<string | null>(null)
  const [breakError, setBreakError] = useState<string | null>(null)

  const handleBreakContact = useCallback(
    async (contactId: string): Promise<boolean> => {
      setBreakingContactId(contactId)
      setBreakError(null)
      try {
        await breakContactRequest(contactId)
        setContactsOverride((previous) =>
          (previous ?? data ?? []).filter((contact) => contact.id !== contactId),
        )
        return true
      } catch (caughtError: unknown) {
        setBreakError(getErrorMessage(caughtError, 'Impossible de rompre ce contact.'))
        return false
      } finally {
        setBreakingContactId(null)
      }
    },
    [data],
  )

  return {
    contacts,
    isLoading,
    error,
    breakContact: handleBreakContact,
    breakingContactId,
    breakError,
  }
}
