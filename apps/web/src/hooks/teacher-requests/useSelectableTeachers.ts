/**
 * useSelectableTeachers — annuaire des formateurs que le RP peut solliciter (étape 3).
 *
 * ⚠️ **Aucune route ne permet aujourd'hui de lister les formateurs de la plateforme.**
 * Vérifié contre la pile réelle le 2026-08-12, avec le jeton d'un `responsable_pedagogique` :
 *
 * | Appel                                        | Réponse |
 * |----------------------------------------------|---------|
 * | `GET /profiles/teachers/pending-validation`  | `200 []` — seulement les formateurs **en attente de validation**, c'est-à-dire précisément ceux qu'on ne propose pas |
 * | `GET /accounts`, `GET /accounts?role=formateur` | `403` |
 * | `GET /relations/my-contacts`                 | `200 []` — le RP n'est relié à personne |
 * | `GET /profiles/teachers`, `/teachers`, `/profiles/search?role=` | `400` / `404` |
 *
 * Le champ « UUID du formateur à proposer » qui existait auparavant est supprimé sans
 * remplacement : faire saisir un identifiant technique est interdit (arbitrage du
 * 2026-08-09), et l'étape était de toute façon inutilisable en pratique.
 *
 * Ce qui manque côté serveur : une route de listage des formateurs **validés**,
 * accessible au RP, renvoyant `{userId, firstName, lastName}` — le nom seul suffit,
 * comme `GET /relations/my-contacts` le fait déjà pour les contacts.
 *
 * Quand elle existera, il n'y aura qu'à remplacer le corps de ce hook : le composeur
 * (`TeacherProposalComposer`) est déjà écrit pour une sélection multiple par cases à
 * cocher et n'aura pas à changer.
 */

export interface SelectableTeacher {
  userId: string
  displayName: string
}

export interface UseSelectableTeachersResult {
  teachers: SelectableTeacher[]
  isLoading: boolean
  /** `true` tant qu'aucune route d'annuaire n'existe côté serveur. */
  isDirectoryUnavailable: boolean
}

export function useSelectableTeachers(): UseSelectableTeachersResult {
  return {
    teachers: [],
    isLoading: false,
    isDirectoryUnavailable: true,
  }
}
