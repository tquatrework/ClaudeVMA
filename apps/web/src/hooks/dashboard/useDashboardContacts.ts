import { fetchContacts } from '../../api/communication'
import type { Contact } from '../../api/communication'
import { useAsyncData } from '../useAsyncData'

export interface UseDashboardContactsResult {
  contacts: Contact[]
  isLoadingContacts: boolean
  contactsError: string | null
}

/**
 * useDashboardContacts — charge GET /contacts, ne garde que les contacts actifs et les
 * limite à `limit` entrées. Utilisé par EleveDashboardPage (carte "Contacts importants").
 *
 * Comportement préexistant préservé : aucun message d'erreur affiché en cas d'échec
 * (dégradation silencieuse vers liste vide) — `contactsError` exposé mais non rendu.
 */
export function useDashboardContacts(limit: number): UseDashboardContactsResult {
  const { data, isLoading, error } = useAsyncData(fetchContacts, [], {
    fallbackErrorMessage: 'Impossible de charger les contacts',
  })

  return {
    contacts: (data ?? []).filter((contact) => contact.status === 'active').slice(0, limit),
    isLoadingContacts: isLoading,
    contactsError: error,
  }
}
