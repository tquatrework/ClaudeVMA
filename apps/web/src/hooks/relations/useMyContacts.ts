/**
 * useMyContacts — les personnes auxquelles l'utilisateur connecté est relié.
 *
 * Un seul appel (`GET /relations/my-contacts`), valable pour TOUS les rôles :
 * plus de `fetchLinkedStudents(user.id)` qui n'interroge que la table financeur↔élève
 * et répond `200 []` à un formateur, sans le moindre message.
 *
 * Le nom affichable est construit ici, une fois : les écrans ne manipulent jamais
 * `userId`, qui ne sert qu'à construire l'appel suivant.
 */

import { fetchMyContacts } from '../../api/relations'
import type { MyContact } from '../../types/relations'
import { formatFullName } from '../../utils/nameFormat'
import { useAsyncData } from '../useAsyncData'

export interface ContactOption extends MyContact {
  /** Prénom + nom, ou repli explicite — jamais un UUID. */
  displayName: string
}

export interface UseMyContactsResult {
  contacts: ContactOption[]
  isLoading: boolean
  error: string | null
}

const MISSING_NAME_LABEL = 'Contact (nom non renseigné)'

export function toContactOption(contact: MyContact): ContactOption {
  return {
    ...contact,
    displayName: formatFullName(contact.firstName, contact.lastName) || MISSING_NAME_LABEL,
  }
}

export function useMyContacts(): UseMyContactsResult {
  const { data, isLoading, error } = useAsyncData(fetchMyContacts, [], {
    fallbackErrorMessage: 'Impossible de charger vos contacts.',
  })

  return {
    contacts: (data ?? []).map(toContactOption),
    isLoading,
    error,
  }
}
