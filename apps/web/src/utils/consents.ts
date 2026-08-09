/**
 * consents.ts — libellés, mise en forme et traduction d'erreurs des consentements RGPD.
 *
 * Fonctions pures partagées par la page `/consents` et ses composants. Deux principes
 * y sont tenus, hérités du contrat serveur (docs/routes.md > Consentements RGPD) :
 *
 * 1. **Le serveur fait autorité sur ce qui est obligatoire et sur ce qui est retirable.**
 *    Aucune fonction de ce fichier ne redéduit la liste des consentements obligatoires :
 *    elles lisent `isMandatory` / `isWithdrawable`.
 * 2. **Un consentement retiré n'est jamais présenté comme accordé.** Les trois statuts
 *    (`granted`, `withdrawn`, `never_granted`) reçoivent trois libellés distincts.
 */

import type { ConsentState, ConsentStatus, ConsentType } from '../types/accounts'
import { getErrorMessage, getErrorStatus } from './apiError'

/**
 * Libellés courts des types de consentement.
 * Repris à l'identique de l'étape « Consentements » de l'inscription
 * (`RegistrationRgpdStep`) pour que l'utilisateur reconnaisse ce qu'il a signé.
 */
const CONSENT_LABELS: Record<ConsentType, string> = {
  rgpd: 'Protection des données personnelles (RGPD)',
  cgu: "Conditions générales d'utilisation (CGU)",
  marketing: 'Communications commerciales',
}

const CONSENT_DESCRIPTIONS: Record<ConsentType, string> = {
  rgpd: 'Traitement de mes données personnelles conformément au RGPD.',
  cgu: "Conditions générales d'utilisation de la plateforme VisioMath.",
  marketing: 'Recevoir des communications commerciales de VisioMath.',
}

const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  granted: 'Accordé',
  withdrawn: 'Retiré',
  never_granted: 'Non donné',
}

/** Classes de badge par statut, à passer à `StatusBadge`. */
export const CONSENT_STATUS_BADGE_CLASSES: Record<ConsentStatus, string> = {
  granted: 'bg-green-100 text-green-700',
  withdrawn: 'bg-amber-100 text-amber-800',
  never_granted: 'bg-gray-100 text-gray-600',
}

/**
 * Libellé lisible d'un type de consentement.
 * Un type inconnu (serveur en avance sur le front) est rendu tel quel plutôt que
 * masqué : mieux vaut un libellé brut qu'une ligne invisible sur un écran RGPD.
 */
export function getConsentLabel(consentType: string): string {
  return CONSENT_LABELS[consentType as ConsentType] ?? consentType
}

/** Description d'un type de consentement, vide si le type est inconnu du front. */
export function getConsentDescription(consentType: string): string {
  return CONSENT_DESCRIPTIONS[consentType as ConsentType] ?? ''
}

/** Libellé métier du statut courant — jamais la valeur d'enum technique. */
export function getConsentStatusLabel(status: ConsentStatus): string {
  return CONSENT_STATUS_LABELS[status] ?? status
}

/** Formate une date ISO en `JJ/MM/AAAA`, ou `null` si la date est absente/invalide. */
function formatConsentDate(isoDate: string | null): string | null {
  if (!isoDate) return null
  const parsedDate = new Date(isoDate)
  if (Number.isNaN(parsedDate.getTime())) return null
  return parsedDate.toLocaleDateString('fr-FR')
}

/**
 * Résume l'historique utile d'un consentement en une phrase.
 *
 * `grantedAt` reste renseigné après un retrait : « Accepté le X, retiré le Y » se
 * construit donc sans appel supplémentaire à `GET /consents/history`.
 *
 * @returns la phrase à afficher, ou `null` s'il n'y a rien d'utile à dire
 *   (consentement jamais donné, ou dates absentes).
 */
export function formatConsentTimeline(consent: ConsentState): string | null {
  const grantedDate = formatConsentDate(consent.grantedAt)
  const withdrawnDate = formatConsentDate(consent.withdrawnAt)

  if (consent.status === 'withdrawn') {
    if (grantedDate && withdrawnDate) return `Accepté le ${grantedDate}, retiré le ${withdrawnDate}`
    if (withdrawnDate) return `Retiré le ${withdrawnDate}`
    return 'Retiré'
  }

  if (consent.status === 'granted' && grantedDate) {
    return `Accepté le ${grantedDate}`
  }

  return null
}

/**
 * Ordonne les consentements pour l'affichage : obligatoires d'abord, optionnels ensuite.
 *
 * Le tri s'appuie sur `isMandatory` renvoyé par le serveur, jamais sur une liste de
 * types recopiée dans le front. L'ordre du serveur est conservé à l'intérieur de
 * chaque groupe (tri stable).
 */
export function sortConsentsForDisplay(consents: ConsentState[]): ConsentState[] {
  return [...consents].sort(
    (firstConsent, secondConsent) =>
      Number(secondConsent.isMandatory) - Number(firstConsent.isMandatory),
  )
}

/**
 * Tous les consentements obligatoires sont-ils accordés ?
 *
 * C'est la seule condition d'activation du compte : retirer un consentement
 * optionnel (marketing) ne la remet jamais en cause.
 */
export function hasGrantedAllMandatoryConsents(consents: ConsentState[]): boolean {
  const mandatoryConsents = consents.filter((consent) => consent.isMandatory)
  return mandatoryConsents.length > 0 && mandatoryConsents.every((consent) => consent.isGranted)
}

/**
 * Confirmation affichée après un retrait réussi.
 *
 * Elle dit explicitement que le compte reste actif : un utilisateur qui retire son
 * consentement marketing ne doit pas croire qu'il vient de désactiver son compte.
 */
export function buildWithdrawalSuccessMessage(consentType: string): string {
  return `Consentement « ${getConsentLabel(consentType)} » retiré. Votre compte reste actif : seuls les consentements obligatoires conditionnent son activation. Vous pourrez le redonner à tout moment depuis cette page.`
}

/** Confirmation affichée après un octroi ou une ré-acceptation réussie. */
export function buildGrantSuccessMessage(consentType: string): string {
  return `Consentement « ${getConsentLabel(consentType)} » enregistré.`
}

/**
 * Message affiché quand le serveur refuse le retrait d'un consentement obligatoire (`403`).
 *
 * Le parcours de fermeture de compte n'existe pas encore dans l'application : on
 * indique à qui s'adresser, sans proposer de lien vers une page inexistante.
 */
export const MANDATORY_CONSENT_WITHDRAWAL_MESSAGE =
  "Ce consentement conditionne le fonctionnement de votre compte : il ne peut pas être retiré depuis cette page. Le retirer revient à fermer le compte — pour cela, adressez votre demande au support VisioMath, qui la traitera avec vous."

/**
 * Traduit l'échec d'un retrait en message lisible.
 *
 * Les messages sont écrits ici plutôt que repris du serveur, pour rester maîtrisés
 * et en français quel que soit le libellé technique renvoyé.
 */
export function getConsentWithdrawalErrorMessage(error: unknown): string {
  switch (getErrorStatus(error)) {
    case 400:
      return "Ce type de consentement n'est pas reconnu par le service. Rechargez la page, puis réessayez."
    case 403:
      return MANDATORY_CONSENT_WITHDRAWAL_MESSAGE
    case 404:
      return "Vous n'avez jamais donné ce consentement : il n'y a rien à retirer."
    case 409:
      return 'Ce consentement est déjà retiré. Rechargez la page pour voir son état à jour.'
    default:
      return getErrorMessage(error, 'Impossible de retirer ce consentement. Veuillez réessayer.')
  }
}

/** Traduit l'échec d'un octroi (premier accord ou ré-acceptation) en message lisible. */
export function getConsentGrantErrorMessage(error: unknown): string {
  switch (getErrorStatus(error)) {
    case 400:
      return "Ce type de consentement n'est pas reconnu par le service. Rechargez la page, puis réessayez."
    case 409:
      return 'Ce consentement est déjà accordé. Rechargez la page pour voir son état à jour.'
    default:
      return getErrorMessage(error, "Impossible d'enregistrer ce consentement. Veuillez réessayer.")
  }
}
