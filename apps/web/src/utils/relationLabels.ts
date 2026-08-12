/**
 * Point unique des libellés français du lien de financement parent financeur ↔ élève.
 *
 * Règle de langue du 2026-08-09 : noms techniques en anglais, tout ce que
 * l'utilisateur lit en français, la correspondance portée en **un seul endroit**.
 * Les deux écrans de la relation (« Parents financeurs » côté élève, « Mes élèves /
 * enfants » côté parent) sont symétriques : sans point unique, le même lien finirait
 * par porter deux formulations selon l'onglet.
 */

import type { FinanceOwnerStudentLink } from '../types/relations'
import { formatPersonName } from './nameFormat'
import { getErrorMessage, getErrorStatus } from './apiError'

/**
 * De quel côté du lien se trouve la personne qui regarde l'écran.
 * `student` : l'élève liste ses parents financeurs.
 * `finance_owner` : le parent financeur liste ses élèves.
 */
export type FinanceLinkViewerSide = 'student' | 'finance_owner'

/**
 * Repli lisible quand la personne n'a pas de profil administratif : un libellé de
 * rôle, jamais un UUID (arbitrage du 2026-08-09).
 */
export const FINANCE_OWNER_GENERIC_LABEL = 'Financeur'
export const STUDENT_GENERIC_LABEL = 'Élève'

/**
 * Verbe retenu : « Délier », et non « Supprimer ». Il dit ce qui se passe
 * réellement — la personne n'est pas supprimée, c'est le lien qui est rompu.
 */
export const UNLINK_ACTION_LABEL = 'Délier'

/**
 * Nom affichable de l'**autre** partie du lien, selon le côté d'où on regarde.
 * Le nom vient du serveur (`financeOwnerName` / `studentName`) : aucun appel
 * supplémentaire, aucun UUID.
 */
export function describeFinanceLinkCounterpart(
  link: FinanceOwnerStudentLink,
  viewerSide: FinanceLinkViewerSide,
): string {
  return viewerSide === 'student'
    ? formatPersonName(link.financeOwnerName, FINANCE_OWNER_GENERIC_LABEL)
    : formatPersonName(link.studentName, STUDENT_GENERIC_LABEL)
}

/**
 * Ce que la rupture referme, dit du point de vue du lecteur. Rompre le lien
 * referme d'un coup profil, statistiques et archives pédagogiques, dans les deux
 * sens : l'utilisateur doit le savoir **avant** de confirmer.
 */
export function describeUnlinkConsequence(viewerSide: FinanceLinkViewerSide): string {
  return viewerSide === 'student'
    ? "Cette personne n'aura plus accès à votre profil, à vos statistiques ni à vos archives pédagogiques."
    : "Vous n'aurez plus accès au profil, aux statistiques ni aux archives pédagogiques de cette personne."
}

/**
 * Refus documentés de `DELETE /relations/finance-owner-student/...`, traduits ici et
 * non repris du serveur : ses messages sont en anglais technique pour le `400`
 * (« Validation failed (uuid is expected) ») comme pour le `401` (« Unauthorized »),
 * vérifié contre la pile réelle le 2026-08-11. Règle de langue du 2026-08-09 : tout
 * ce que l'utilisateur lit est en français.
 *
 * Le `404` recouvre **deux causes volontairement indiscernables** — lien inexistant,
 * ou appelant sans droit sur ce lien. Le message les nomme toutes les deux sans en
 * choisir une : supposer laquelle s'applique reviendrait à révéler ce que le serveur
 * refuse justement de dire.
 */
const UNLINK_FAILURE_MESSAGES: Record<number, string> = {
  400: "Ce lien n'a pas pu être rompu : la demande a été refusée. Rechargez la page, puis réessayez.",
  401: 'Votre session a expiré. Reconnectez-vous, puis réessayez.',
  404: "Ce lien n'a pas pu être rompu : il n'existe plus, ou il ne vous appartient pas.",
}

/** Message d'échec d'une rupture, en français quel que soit le refus. */
export function describeUnlinkFailure(error: unknown): string {
  const status = getErrorStatus(error)
  if (status !== undefined && UNLINK_FAILURE_MESSAGES[status]) {
    return UNLINK_FAILURE_MESSAGES[status]
  }
  return getErrorMessage(error, "Le lien n'a pas pu être rompu. Réessayez dans un instant.")
}
