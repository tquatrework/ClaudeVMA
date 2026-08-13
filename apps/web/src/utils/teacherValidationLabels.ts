/**
 * Point unique de correspondance état technique → libellé français et couleur,
 * pour la **validation des nouveaux formateurs** (profile-service).
 *
 * Règle de langue du 2026-08-09 : noms techniques en anglais, libellés en
 * français, correspondance en un seul endroit. Ces tables vivaient jusqu'ici en
 * dur dans `TeacherValidationPanel` ; la file de validation du RP en aurait fait
 * une seconde copie, avec le risque habituel qu'un même état s'affiche
 * différemment selon l'écran.
 *
 * Domaine distinct de `teacherRequestLabels.ts` : là un flow de demande d'élève,
 * ici un cycle de vie de compte formateur. Deux domaines, deux tables.
 */

import { formatLongDate } from './dateFormat'
import type { TeacherValidationRecord, TeacherValidationState } from '../types/profile'

export const TEACHER_VALIDATION_STATE_LABELS: Record<TeacherValidationState, string> = {
  pending: 'En attente de prise en charge',
  in_review: "En cours d'examen",
  validated: 'Validé',
  rejected: 'Refusé',
}

export const TEACHER_VALIDATION_STATE_COLORS: Record<TeacherValidationState, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_review: 'bg-blue-100 text-blue-700',
  validated: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

/** Libellé français d'un état, y compris si le serveur en introduit un inconnu. */
export function getTeacherValidationStateLabel(status: string): string {
  return TEACHER_VALIDATION_STATE_LABELS[status as TeacherValidationState] ?? status
}

/**
 * États terminaux : le dossier quitte la file de travail du RP.
 * `in_review` n'en fait pas partie — le dossier reste à instruire.
 */
export function isTerminalValidationState(status: TeacherValidationState): boolean {
  return status === 'validated' || status === 'rejected'
}

/**
 * Le RP peut-il valider ou refuser directement depuis cet état ?
 *
 * Non depuis `pending` : le serveur réserve ce raccourci au TI et répond `403`.
 * Le front n'affiche donc pas l'action — règle projet : ne jamais proposer une
 * entrée qui mène à un refus.
 */
export function canDecideFromState(status: TeacherValidationState): boolean {
  return status === 'in_review'
}

/** Le dossier peut-il être pris en charge (passage en `in_review`) ? */
export function canTakeChargeFromState(status: TeacherValidationState): boolean {
  return status === 'pending'
}

/**
 * Message affiché AU FORMATEUR LUI-MÊME à propos de son propre statut de
 * validation (arbitrage du 2026-08-13, `docs/architecture.md` > « Visibilité du
 * statut de validation, côté formateur »).
 *
 * `pending` et `in_review` se confondent volontairement : la distinction n'a de
 * sens que pour le RP qui instruit le dossier, pas pour le formateur qui
 * attend. `validated` n'affiche rien — aucune exigence posée par l'arbitrage.
 *
 * À ne pas confondre avec `user.validationStatus` (`AuthContext`) : celui-ci
 * porte le statut du **compte** (consentements signés, identity-access-service)
 * et alimente la bannière « Votre compte n'est pas encore activé » de
 * `Layout.tsx`. Ici, la donnée vient de `profile-service` et porte le statut du
 * **dossier formateur** instruit par le RP — deux données distinctes, un seul
 * nom chacune.
 */
export interface OwnTeacherValidationMessage {
  message: string
  tone: 'pending' | 'rejected'
}

export function getOwnTeacherValidationMessage(
  record: TeacherValidationRecord | null,
): OwnTeacherValidationMessage | null {
  if (!record) return null

  if (record.status === 'pending' || record.status === 'in_review') {
    return {
      message: 'Votre dossier formateur est en attente de validation par notre équipe pédagogique.',
      tone: 'pending',
    }
  }

  if (record.status === 'rejected') {
    const reapplyDateLabel = getReapplyEligibleDateLabel(record)
    if (reapplyDateLabel === null) {
      return {
        message: 'Votre candidature formateur n\'a pas été retenue. Vous pourrez vous représenter l\'année prochaine.',
        tone: 'rejected',
      }
    }
    return {
      message:
        `Votre candidature formateur n'a pas été retenue. Vous pourrez vous représenter ` +
        `à partir du ${reapplyDateLabel}.`,
      tone: 'rejected',
    }
  }

  return null
}

/**
 * Libellé français de `reapplyEligibleAt`, tel que renvoyé par le serveur
 * (`GET /profiles/:teacherId/validation`) — porte la vraie règle (année
 * scolaire, 1er août), le front ne la dérive plus depuis `updatedAt`.
 *
 * `formatLongDate` produit « 1 août 2026 » (jour cardinal) : on substitue « 1er »
 * quand le jour vaut 1, seul cas réellement produit par la règle serveur, pour
 * un français correct sans réécrire le formateur de date général.
 */
function getReapplyEligibleDateLabel(record: TeacherValidationRecord): string | null {
  if (!record.reapplyEligibleAt) return null
  const parsedDate = new Date(record.reapplyEligibleAt)
  if (Number.isNaN(parsedDate.getTime())) return null
  const longDateLabel = formatLongDate(record.reapplyEligibleAt)
  return longDateLabel.startsWith('1 ') ? `1er ${longDateLabel.slice(2)}` : longDateLabel
}

/**
 * Le formateur peut-il relancer une candidature dès maintenant ? Vrai
 * uniquement pour un dossier `rejected` dont `reapplyEligibleAt` est passé
 * (arbitrage du 2026-08-13). Avant cette date, seul le message d'échéance
 * s'affiche — pas de bouton.
 */
export function isReapplyEligible(record: TeacherValidationRecord | null): boolean {
  if (!record || record.status !== 'rejected' || !record.reapplyEligibleAt) return false
  const parsedDate = new Date(record.reapplyEligibleAt)
  if (Number.isNaN(parsedDate.getTime())) return false
  return parsedDate.getTime() <= Date.now()
}
