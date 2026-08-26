/**
 * resourceLinks.ts — validation front des liens externes d'une entrée de
 * cahier de texte (`resourceLinks`, `docs/routes.md` § « Liens et pièces
 * jointes », 2026-08-26).
 *
 * Le serveur revalide de toute façon (`label` requis 200 caractères max, `url`
 * absolue `http(s)://` uniquement, 10 liens maximum) : ce module ne dispense
 * pas de cette validation, il évite juste un aller-retour réseau pour une
 * saisie manifestement invalide — même raisonnement que le contrôle de poids
 * local avant l'envoi d'une photo de profil (`profileAvatarConstraints.ts`).
 */

import { MAX_RESOURCE_LINKS, type ResourceLink } from '../api/pedagogicalLog'

export { MAX_RESOURCE_LINKS }

export const MAX_RESOURCE_LINK_LABEL_LENGTH = 200

/** Un lien vide (les deux champs non renseignés) — jamais envoyé au serveur. */
export function isEmptyResourceLink(link: ResourceLink): boolean {
  return link.label.trim().length === 0 && link.url.trim().length === 0
}

/** URL absolue `http://` ou `https://` — une URL relative ou `javascript:` est refusée. */
export function isAbsoluteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim())
}

/**
 * Message d'erreur pour un lien invalide, ou `null` s'il est valide.
 * Un lien totalement vide n'est **pas** une erreur : il est simplement omis
 * de l'envoi (voir `isEmptyResourceLink`).
 */
export function getResourceLinkValidationError(link: ResourceLink): string | null {
  if (isEmptyResourceLink(link)) return null

  const trimmedLabel = link.label.trim()
  const trimmedUrl = link.url.trim()

  if (trimmedLabel.length === 0) {
    return 'Chaque lien doit avoir un texte affiché.'
  }
  if (trimmedLabel.length > MAX_RESOURCE_LINK_LABEL_LENGTH) {
    return `Le texte affiché d'un lien ne peut pas dépasser ${MAX_RESOURCE_LINK_LABEL_LENGTH} caractères.`
  }
  if (trimmedUrl.length === 0) {
    return 'Chaque lien doit avoir une adresse (URL).'
  }
  if (!isAbsoluteHttpUrl(trimmedUrl)) {
    return "L'adresse d'un lien doit commencer par http:// ou https://."
  }
  return null
}

/**
 * Valide l'ensemble des liens saisis (hors lignes vides) avant l'envoi.
 * Renvoie le premier message d'erreur rencontré, ou `null` si tout est valide.
 */
export function validateResourceLinks(links: ResourceLink[]): string | null {
  const nonEmptyLinks = links.filter((link) => !isEmptyResourceLink(link))

  if (nonEmptyLinks.length > MAX_RESOURCE_LINKS) {
    return `Vous ne pouvez pas ajouter plus de ${MAX_RESOURCE_LINKS} liens.`
  }

  for (const link of nonEmptyLinks) {
    const error = getResourceLinkValidationError(link)
    if (error) return error
  }

  return null
}

/** Liens prêts à être envoyés au serveur : lignes vides retirées, valeurs nettoyées. */
export function toSubmittableResourceLinks(links: ResourceLink[]): ResourceLink[] {
  return links
    .filter((link) => !isEmptyResourceLink(link))
    .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
}
