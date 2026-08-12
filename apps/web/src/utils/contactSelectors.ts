/**
 * Sélections pures sur la liste renvoyée par `GET /relations/my-contacts`.
 *
 * Ces filtres évitent de recopier la logique « quel `kind` désigne un élève dont je suis
 * le financeur ? » dans chaque écran. Ils ne font aucun appel réseau : la page charge les
 * contacts une fois, les vues en dérivent ce dont elles ont besoin.
 */

import type { ContactOption } from '../hooks/relations/useMyContacts'

/** Les élèves dont l'utilisateur authentifié est le parent financeur. */
export function selectFinancedStudents(contacts: ContactOption[]): ContactOption[] {
  return contacts.filter((contact) =>
    contact.relations.some((relation) => relation.kind === 'finance_owner_of_student'),
  )
}

/**
 * Les formateurs d'un élève donné, vus par son parent financeur.
 *
 * Le lien est **indirect** : `finance_owner_of_student_of_teacher` porte dans
 * `throughUserIds` l'élève par lequel il passe. C'est ce qui permet d'offrir au parent
 * une liste de professeurs sans jamais lui demander d'identifiant.
 */
export function selectTeachersOfStudent(
  contacts: ContactOption[],
  studentId: string,
): ContactOption[] {
  return contacts.filter((contact) =>
    contact.relations.some(
      (relation) =>
        relation.kind === 'finance_owner_of_student_of_teacher' &&
        (relation.throughUserIds ?? []).includes(studentId),
    ),
  )
}
