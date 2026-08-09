/**
 * Lecture du bloc `visibility` renvoyé par `GET /profiles/:userId` et
 * `GET /profiles/:userId/statistics` — **point unique** de la distinction entre
 * « non renseigné » et « non partagé ».
 *
 * Pourquoi une distinction, et pourquoi elle compte :
 *
 * Le serveur **retire** du bloc les champs que le titulaire ne partage pas avec
 * ce lecteur ; il ne les met pas à `null`. Une clé présente valant `null` veut
 * donc dire « non renseigné », une clé absente nommée dans `hiddenFields` veut
 * dire « non partagé ». Confondre les deux rendrait l'écran menteur : un
 * formateur croirait que l'élève n'a rien saisi alors qu'il a seulement choisi
 * de ne pas partager.
 *
 * Le vocabulaire retenu à l'écran est « Non partagé », jamais « Masqué par
 * l'élève » : le front ignore si le champ a un contenu (le serveur filtre sur le
 * réglage, pas sur la valeur), et un réglage de confidentialité est un droit,
 * pas une faute. « Non partagé » dit exactement ce qui est vrai — rien sur le
 * contenu, tout sur le partage.
 *
 * Règle de langue (`docs/architecture.md` § « Langue de l'application ») : les
 * libellés vivent ici et dans `profileFieldLabels.ts`, jamais recopiés dans un
 * composant.
 */

import type { ProfileVisibility } from '../types/profile'

/** Valeur affichée à la place d'un champ que le titulaire ne partage pas. */
export const NOT_SHARED_PLACEHOLDER = 'Non partagé'

/**
 * Explication affichée **une fois par fiche**, pas à chaque champ : répétée, elle
 * deviendrait un reproche adressé au titulaire.
 */
export const FILTERED_PROFILE_TITLE = 'Vous consultez une fiche partielle'

export const FILTERED_PROFILE_DESCRIPTION =
  'Le titulaire de cette fiche choisit qui peut voir chacune de ses informations. ' +
  'Les champs qu’il ne partage pas avec vous portent la mention « Non partagé » : ' +
  'ce n’est ni un oubli de sa part, ni une erreur d’affichage.'

/** Mention portée par la section prescription quand elle est entièrement masquée. */
export const PRESCRIPTION_NOT_SHARED_MESSAGE =
  'Les préconisations du responsable pédagogique ne vous sont pas communiquées.'

/**
 * La fiche lue est-elle amputée de champs ?
 *
 * On se fie à `isFiltered`, pas à `hiddenFields.length` : un lecteur filtré dont
 * tous les champs se trouvent visibles reçoit `isFiltered: true` avec une liste
 * vide, et ce n'est pas la même information qu'une fiche entière. Une réponse
 * sans bloc `visibility` (serveur antérieur) est traitée comme non filtrée —
 * mieux vaut ne rien annoncer qu'annoncer un filtrage inexistant.
 */
export function isProfileFiltered(visibility?: ProfileVisibility | null): boolean {
  return visibility?.isFiltered === true
}

/** Ce champ précis est-il masqué au lecteur courant ? */
export function isFieldHidden(
  fieldName: string,
  visibility?: ProfileVisibility | null,
): boolean {
  if (!visibility?.hiddenFields) return false
  return visibility.hiddenFields.includes(fieldName)
}

/**
 * Champs masqués **parmi ceux qu'une section donnée affiche**, dans l'ordre
 * d'affichage de cette section.
 *
 * Le filtrage par section évite d'annoncer sous « Informations administratives »
 * un champ pédagogique masqué : `hiddenFields` couvre toute la fiche, une section
 * n'en montre qu'une part.
 */
export function pickHiddenFieldNames(
  displayFieldNames: readonly string[],
  visibility?: ProfileVisibility | null,
): string[] {
  if (!visibility?.hiddenFields?.length) return []
  return displayFieldNames.filter((fieldName) => visibility.hiddenFields.includes(fieldName))
}
