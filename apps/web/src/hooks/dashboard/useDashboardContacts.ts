import { fetchContacts } from '../../api/contacts'
import type { DashboardContact } from '../../types/dashboard'
import { formatContactDisplayName } from '../communication/useContacts'
import { useAsyncData } from '../useAsyncData'

export interface UseDashboardContactsResult {
  contacts: DashboardContact[]
  isLoadingContacts: boolean
  contactsError: string | null
}

/**
 * useDashboardContacts — charge GET /contacts (contacts ACTIFS), les limite à
 * `limit` entrées. Utilisé par EleveDashboardPage (carte "Contacts importants").
 *
 * Réaligné le 2026-09-05 sur le modèle Contact réel de communication-service
 * (docs/architecture/contacts-messagerie.md, 2026-09-04) : `GET /contacts` ne renvoie
 * plus que des contacts actifs (plus de précontacts/obligatoires), le nom affiché est
 * résolu ici via `formatContactDisplayName` — jamais un UUID.
 *
 * Comportement préexistant préservé : aucun message d'erreur affiché en cas d'échec
 * (dégradation silencieuse vers liste vide) — `contactsError` exposé mais non rendu.
 */
export function useDashboardContacts(limit: number): UseDashboardContactsResult {
  const { data, isLoading, error } = useAsyncData(fetchContacts, [], {
    fallbackErrorMessage: 'Impossible de charger les contacts',
  })

  return {
    contacts: (data ?? []).slice(0, limit).map((contact) => ({
      id: contact.id,
      counterpartId: contact.counterpartId,
      displayName: formatContactDisplayName(contact),
    })),
    isLoadingContacts: isLoading,
    contactsError: error,
  }
}
