/**
 * registrationConsents — traduction des cases cochées à l'étape « Consentements
 * RGPD / CGU » en champ `consents` du corps de création de compte.
 *
 * Contrat serveur (docs/routes.md > identity-access-service > `consents`) :
 * `consents: [{consentType: 'rgpd' | 'cgu' | 'marketing', version?: string}]`,
 * strictement la même forme que le corps de `POST /consents` — même table, même
 * trace (IP, horodatage), enregistrée dans la transaction de création du compte.
 *
 * Trois règles portées ici :
 * 1. **N'envoyer que ce qui a réellement été coché.** Une case décochée ne produit
 *    aucune entrée : le serveur ne doit jamais recevoir un consentement que
 *    l'utilisateur n'a pas donné.
 * 2. **Ne rien envoyer plutôt qu'un tableau vide** quand rien n'est coché : le champ
 *    est optionnel, son absence est plus lisible côté serveur qu'un tableau vide.
 * 3. **`marketing` est optionnel et ne bloque rien.** Il suit exactement la règle 1 :
 *    aucune entrée `marketing` ne part tant que l'utilisateur ne l'a pas cochée. Seuls
 *    `rgpd` et `cgu` restent obligatoires pour créer le compte
 *    (voir `hasGivenRequiredConsents`, qui ignore délibérément `marketing`).
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
  // Consentement optionnel : il n'est transmis que s'il a été coché. Enregistrer un
  // consentement marketing non donné serait plus grave que de ne rien enregistrer.
  if (consentsFormData.hasAcceptedMarketing) {
    acceptedConsents.push({ consentType: 'marketing' })
  }

  return acceptedConsents.length > 0 ? acceptedConsents : undefined
}

/**
 * Les deux consentements obligatoires sont-ils donnés ?
 *
 * Quand c'est le cas, le serveur renvoie le compte `active` / `consentSigned: true`
 * dès le `201` : ni bandeau « compte pas encore activé », ni écran de signature
 * après connexion.
 *
 * `marketing` n'entre volontairement pas dans ce calcul : il est optionnel, l'inscription
 * aboutit qu'il soit coché ou non.
 */
export function hasGivenRequiredConsents(
  consentsFormData: RegistrationConsentsFormData,
): boolean {
  return consentsFormData.hasAcceptedRgpd && consentsFormData.hasAcceptedCgu
}
