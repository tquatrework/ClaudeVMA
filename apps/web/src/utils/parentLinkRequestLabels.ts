/**
 * Libellés français des demandes de rattachement parent ↔ élève — point unique.
 *
 * Règle de langue du projet (docs/architecture.md, 2026-08-09) : les noms
 * techniques restent en anglais, tout ce que l'utilisateur lit est en français,
 * et la correspondance vit en **un seul endroit** — sinon un même état finit par
 * porter deux libellés selon l'écran.
 *
 * Règle UX associée : aucun identifiant technique n'est affiché. Un UUID tronqué
 * (`ELV-36c4b5b8`) reste un UUID : il ne nomme personne. Quand le nom n'est pas
 * accessible au lecteur, on le dit en français plutôt que de retomber sur l'id.
 */

import type { ParentLinkRequestDirection, ParentLinkRequestStatus } from '../api/parentLinkRequest'
import type { PersonName } from '../types/profile'
import { formatPersonName } from './nameFormat'

export const PARENT_LINK_REQUEST_STATUS_LABELS: Record<ParentLinkRequestStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Refusée',
}

export const PARENT_LINK_REQUEST_STATUS_BADGE_CLASSES: Record<ParentLinkRequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

/**
 * Personne « en face » d'une demande, du point de vue du lecteur.
 *
 * `parent_initiated` → c'est le parent financeur qui a fait la demande, l'élève
 * la reçoit ; `student_initiated` → l'inverse. On nomme donc toujours l'autre
 * partie, jamais le lecteur lui-même.
 */
export type ParentLinkRequestCounterpart = 'student' | 'financeOwner'

/** Libellé de rôle générique, utilisé quand le nom de la personne est inconnu. */
export const COUNTERPART_ROLE_LABELS: Record<ParentLinkRequestCounterpart, string> = {
  student: 'Élève',
  financeOwner: 'Parent financeur',
}

/**
 * Libellé affiché quand le lecteur n'a pas accès au nom de la personne.
 *
 * Ce n'est pas « nom non renseigné » : le nom existe, c'est le droit de lecture
 * qui manque tant que le rattachement n'est pas accepté (`GET /profiles/:id`
 * répond 403 entre deux comptes non liés, vérifié sur la pile réelle). Le dire
 * ainsi évite de faire croire à une fiche incomplète.
 */
export function formatUndisclosedCounterpartLabel(
  counterpart: ParentLinkRequestCounterpart,
): string {
  return `${COUNTERPART_ROLE_LABELS[counterpart]} — nom non communiqué`
}

/**
 * Libellé final d'une personne rattachée à une demande.
 *
 * Un seul point d'entrée pour les trois cas : nom connu, nom connu mais profil
 * administratif vide, nom inaccessible au lecteur. Aucun n'affiche d'identifiant.
 */
export function formatCounterpartLabel(
  personName: PersonName | null | undefined,
  counterpart: ParentLinkRequestCounterpart,
): string {
  if (!personName) return formatUndisclosedCounterpartLabel(counterpart)
  return formatPersonName(personName, COUNTERPART_ROLE_LABELS[counterpart])
}

/** Avertissement affiché dès qu'au moins un nom manque sur un écran de décision. */
export const UNDISCLOSED_COUNTERPART_NOTICE =
  "Le nom du demandeur n'est pas communiqué par la plateforme tant que le rattachement n'est pas accepté. Vérifiez auprès de la personne concernée avant d'accepter."

/** Quelle personne nommer selon la direction de la demande. */
export function getCounterpartSide(
  direction: ParentLinkRequestDirection | undefined,
): ParentLinkRequestCounterpart {
  return direction === 'student_initiated' ? 'student' : 'financeOwner'
}
