/**
 * registrationConsents — traduction des cases cochées à l'étape « Consentements
 * RGPD / CGU » en champ `consents` du corps de création de compte.
 *
 * Contrat serveur (docs/routes.md > identity-access-service > `consents`) :
 * `consents: [{consentType: 'rgpd' | 'cgu' | 'marketing', version?: string}]`,
 * strictement la même forme que le corps de `POST /consents` — même table, même
 * trace (IP, horodatage), enregistrée dans la transaction de création du compte.
 *
 * Deux règles portées ici :
 * 1. **N'envoyer que ce qui a réellement été coché.** Une case décochée ne produit
 *    aucune entrée : le serveur ne doit jamais recevoir un consentement que
 *    l'utilisateur n'a pas donné.
 * 2. **Ne rien envoyer plutôt qu'un tableau vide** quand rien n'est coché : le champ
 *    est optionnel, son absence est plus lisible côté serveur qu'un tableau vide.
 *
 * L'ancienne forme `{rgpd: true, cgu: true}` était absorbée en silence par le
 * serveur (aucune ligne écrite, compte laissé `pending`) ; elle renvoie désormais
 * `400`. C'est exactement le défaut que ce module corrige.
 */

import type { RegistrationConsent, RegistrationConsentsFormData } from '../types/accounts'

/**
 * Construit le champ `consents` à partir de l'état des cases à cocher.
 *
 * @returns le tableau des consentements cochés, ou `undefined` si aucun ne l'est.
 */
export function buildRegistrationConsents(
  consentsFormData: RegistrationConsentsFormData,
): RegistrationConsent[] | undefined {
  const acceptedConsents: RegistrationConsent[] = []

  if (consentsFormData.hasAcceptedRgpd) {
    acceptedConsents.push({ consentType: 'rgpd' })
  }
  if (consentsFormData.hasAcceptedCgu) {
    acceptedConsents.push({ consentType: 'cgu' })
  }

  return acceptedConsents.length > 0 ? acceptedConsents : undefined
}

/**
 * Les deux consentements obligatoires sont-ils donnés ?
 *
 * Quand c'est le cas, le serveur renvoie le compte `active` / `consentSigned: true`
 * dès le `201` : ni bandeau « compte pas encore activé », ni écran de signature
 * après connexion.
 */
export function hasGivenRequiredConsents(
  consentsFormData: RegistrationConsentsFormData,
): boolean {
  return consentsFormData.hasAcceptedRgpd && consentsFormData.hasAcceptedCgu
}
