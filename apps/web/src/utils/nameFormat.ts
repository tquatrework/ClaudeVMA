/**
 * Utilitaires de formatage de noms d'utilisateur pour affichage humain.
 *
 * Partagé par les sections de rattachement élève ↔ parent financeur
 * (ParentFinanceurSection, PendingParentInvitationsList, LinkedStudentsSection,
 * PendingStudentRequestsList).
 */

import type { PersonName } from '../types/profile'

/**
 * Construit un libellé humain à partir d'un prénom/nom, avec repli sur
 * l'identifiant de connexion puis sur une mention explicite.
 *
 * Règles produit (consigne UX du projet) :
 * - Le prénom et le nom sont toujours prioritaires quand ils sont disponibles.
 * - Un UUID / identifiant technique n'est JAMAIS affiché : il sert aux URLs, aux
 *   appels API, aux logs et aux clés React, jamais de libellé à l'écran. Cette
 *   fonction ne reçoit donc volontairement pas d'`userId` — pour qu'aucun appelant
 *   ne puisse en réintroduire un par mégarde.
 * - L'identifiant de **connexion** (`loginIdentifier`, ex. `marie.dupont`) est lisible
 *   par un humain : il est affiché entre parenthèses comme désambiguïsateur quand il
 *   est disponible.
 * - Quand prénom/nom sont absents, un libellé générique de rôle (ex. « Financeur »,
 *   « Élève ») est utilisé, complété du `loginIdentifier` s'il existe, sinon d'une
 *   mention explicite « nom non renseigné ».
 */
/**
 * Prénom et nom accolés, ou chaîne vide quand aucun des deux n'est connu.
 *
 * Repli **volontairement vide** : un écran qui n'a pas de nom à montrer n'en
 * invente pas un, et n'y substitue surtout pas un identifiant technique. Les
 * appelants qui ont besoin d'un libellé de repli passent par
 * `formatPersonDisplayName`.
 */
export function formatFullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return [firstName, lastName].filter(Boolean).join(' ')
}

export function formatPersonDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  loginIdentifier: string | null | undefined,
  genericRoleLabel: string,
): string {
  const fullName = formatFullName(firstName, lastName)
  const readableIdentifier = loginIdentifier || undefined

  if (fullName) {
    return readableIdentifier ? `${fullName} (${readableIdentifier})` : fullName
  }

  if (readableIdentifier) {
    return `${genericRoleLabel} (${readableIdentifier})`
  }

  return `${genericRoleLabel} (nom non renseigné)`
}

/**
 * Variante pour les noms déjà résolus côté serveur (`financeOwnerName`, `studentName`
 * des routes de relations). Aucun identifiant de connexion n'accompagne ces champs :
 * le libellé est le nom seul, ou le repli générique explicite.
 */
export function formatPersonName(
  personName: PersonName | null | undefined,
  genericRoleLabel: string,
): string {
  return formatPersonDisplayName(
    personName?.firstName,
    personName?.lastName,
    undefined,
    genericRoleLabel,
  )
}
