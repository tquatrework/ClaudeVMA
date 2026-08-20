/**
 * useEventRecipients — résout la liste des destinataires qu'un rôle donné peut désigner **par
 * nom**, jamais par identifiant saisi — même principe que partout ailleurs dans le projet
 * (arbitrage du 2026-08-09).
 *
 * Extrait de `ProposeCourseSlotDialog` (qui l'utilisait déjà, en ligne) pour être réutilisé par
 * `EventCreateFormModal` (correction du 2026-08-20, point D) sans dupliquer la logique de
 * résolution par rôle — règle de factorisation du projet.
 *
 * - `formateur` → ses élèves (`teacher_of_student`, `useMyContacts`) ;
 * - `animateur_pedagogique` → les formateurs qu'il anime (`animator_of_teacher`, `useMyContacts`) ;
 * - `eleve` → ses formateurs (`student_of_teacher`, `useMyContacts`) ;
 * - `responsable_pedagogique` → n'importe quel formateur validé (`useSelectableTeachers`,
 *   `GET /profiles/teachers/validated`), sans restriction de lien côté serveur ;
 * - tout autre rôle autorisé à créer un événement (TI, AF…) → repli générique sur l'ensemble de
 *   ses contacts liés (`useMyContacts`), faute de relation plus spécifique définie pour ces rôles.
 */

import { useMemo } from 'react'
import { useMyContacts } from '../relations/useMyContacts'
import { useSelectableTeachers } from '../teacher-requests/useSelectableTeachers'
import {
  selectAnimatedTeachers,
  selectMyStudents,
  selectMyTeachers,
} from '../../utils/contactSelectors'
import type { EventRecipientOption } from '../../types/calendar'

export interface UseEventRecipientsResult {
  recipients: EventRecipientOption[]
  isLoading: boolean
  loadError: string | null
}

export function useEventRecipients(userRole: string): UseEventRecipientsResult {
  const isRp = userRole === 'responsable_pedagogique'

  const { contacts, isLoading: isLoadingContacts, error: contactsError } = useMyContacts()
  const {
    teachers: validatedTeachers,
    isLoading: isLoadingValidatedTeachers,
    loadError: validatedTeachersError,
  } = useSelectableTeachers(isRp)

  const recipients = useMemo<EventRecipientOption[]>(() => {
    if (isRp) {
      return validatedTeachers.map((teacher) => ({
        userId: teacher.userId,
        displayName: teacher.displayName,
      }))
    }

    const relatedContacts =
      userRole === 'formateur'
        ? selectMyStudents(contacts)
        : userRole === 'animateur_pedagogique'
          ? selectAnimatedTeachers(contacts)
          : userRole === 'eleve'
            ? selectMyTeachers(contacts)
            : contacts

    return relatedContacts.map((contact) => ({
      userId: contact.userId,
      displayName: contact.displayName,
    }))
  }, [isRp, validatedTeachers, userRole, contacts])

  return {
    recipients,
    isLoading: isRp ? isLoadingValidatedTeachers : isLoadingContacts,
    loadError: isRp ? validatedTeachersError : contactsError,
  }
}
