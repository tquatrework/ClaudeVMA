/**
 * Propagation des réponses d'écriture de profil dans l'état détenu par l'écran.
 *
 * Les trois routes d'écriture renvoient la ressource **à jour** ; jusqu'au
 * 2026-08-10 le front jetait cette réponse et continuait d'afficher les valeurs
 * d'avant l'enregistrement (même défaut que la photo, généralisé à tous les
 * champs). Ces fonctions font entrer la réponse serveur dans l'état de la page,
 * sans nouvelle requête.
 *
 * **Les formes diffèrent, d'où la fusion bloc par bloc** (`docs/routes.md`) :
 *
 * | Route                                    | Réponse                                              |
 * |------------------------------------------|------------------------------------------------------|
 * | `GET /profiles/:userId`                  | enveloppe `{administrative, pedagogical, …}`          |
 * | `PUT /profiles/:userId/administrative`   | bloc **à plat** `{userId, ...champsAdmin}`            |
 * | `PUT /profiles/:userId/pedagogical`      | bloc **à plat** `{userId, ...champsPedago}`           |
 * | `PUT /profiles/:userId/prescription`     | profil pédagogique **complet** + `filledBy`/`filledAt` |
 *
 * Une réponse d'écriture ne remplace donc jamais l'enveloppe : elle est fusionnée
 * dans **son** bloc. Écraser l'enveloppe par un objet plat ferait disparaître les
 * autres blocs de la fiche.
 *
 * La fusion est **additive** : un champ absent de la réponse garde sa valeur
 * courante plutôt que d'être effacé. Les deux routes de profil acceptent des
 * corps partiels — supposer une réponse exhaustive viderait la fiche au premier
 * serveur qui n'en renvoie qu'une partie.
 */

import type { SavedProfileBlock } from '../types/profile'

/**
 * Fusionne la réponse d'une écriture dans le bloc déjà détenu par l'écran.
 *
 * Renvoie **le bloc courant lui-même** quand la réponse n'apporte aucune valeur
 * nouvelle. Cette identité préservée n'est pas une micro-optimisation : les
 * formulaires se réinitialisent sur le changement d'identité de leur source, et
 * fabriquer un objet neuf à chaque enregistrement effacerait la saisie en cours
 * d'un utilisateur dont le serveur a répondu sans rien modifier.
 */
export function mergeSavedProfileBlock(
  /**
   * `object` et non `Record<string, unknown>` : les blocs détenus par les écrans
   * sont tantôt bruts (`pedagogical`), tantôt typés champ par champ
   * (`AdministrativeProfileFields`), et une interface fermée n'a pas de signature
   * d'index.
   */
  currentBlock: object | null | undefined,
  savedBlock: SavedProfileBlock,
): Record<string, unknown> {
  const base = (currentBlock ?? {}) as Record<string, unknown>
  const hasNewValue = Object.keys(savedBlock).some(
    (fieldName) => !Object.is(base[fieldName], savedBlock[fieldName]),
  )

  if (!hasNewValue && currentBlock) return base
  return { ...base, ...savedBlock }
}

/**
 * Une réponse d'écriture exploitable ? Un corps vide, absent ou non structuré ne
 * doit **jamais** être remplacé par le corps envoyé : le serveur normalise,
 * complète et pose des champs (`filledBy`, `filledAt`, `updatedAt`…), et
 * réafficher ce qu'on a envoyé plutôt que ce qui a été enregistré serait un
 * mensonge à l'écran. En l'absence de réponse utilisable, l'écran garde ce qu'il
 * a — l'écriture reste signalée comme réussie.
 */
export function isUsableSavedBlock(savedBlock: unknown): savedBlock is SavedProfileBlock {
  return (
    typeof savedBlock === 'object' &&
    savedBlock !== null &&
    !Array.isArray(savedBlock) &&
    Object.keys(savedBlock).length > 0
  )
}
