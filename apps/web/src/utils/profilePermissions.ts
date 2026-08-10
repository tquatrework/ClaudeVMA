/**
 * Droits d'écriture sur un profil — **point unique**, partagé par la fiche
 * (`ProfilePage`) et l'écran de modification (`ProfileEditPage`).
 *
 * Les deux écrans posaient chacun leur propre condition ; la fiche affichant
 * désormais des champs saisissables, une divergence y ferait apparaître un
 * formulaire que le serveur refuserait — ou masquerait un formulaire légitime.
 *
 * Règles reprises de `docs/architecture.md` § « Arbitrages rendus »
 * (droit d'écriture sur un profil, 2026-08-07) et de `docs/routes.md` :
 *
 * - par défaut, seul l'utilisateur lui-même modifie son profil ;
 * - s'y ajoutent les administrateurs, chacun dans son domaine — RP pour le
 *   pédagogique, TI pour le technique ;
 * - un lien de relation ouvre la lecture, **jamais** l'écriture : le parent
 *   financeur voit tout du profil de son enfant et n'en modifie rien.
 *
 * Le serveur reste seul juge. Ces helpers évitent d'ouvrir une porte qui
 * répondrait `403` (règle de filtrage UI du projet), ils ne remplacent pas son
 * contrôle.
 */

import type { UserRole } from '../types/user'

/** Rôles administratifs autorisés à modifier le profil administratif d'un tiers. */
const ADMINISTRATIVE_EDITOR_ROLES: readonly UserRole[] = [
  'responsable_pedagogique',
  'technicien_informatique',
]

/** Rôles dont le compte porte un profil pédagogique (élève ou formateur). */
const ROLES_WITH_PEDAGOGICAL_PROFILE: readonly UserRole[] = [
  'eleve',
  'formateur',
  'animateur_pedagogique',
]

/**
 * Ce rôle a-t-il un profil pédagogique ?
 *
 * Le parent financeur n'en a pas : lui présenter un formulaire pédagogique vide
 * lui demanderait de renseigner un profil qui n'existe pas pour lui.
 */
export function roleHasPedagogicalProfile(role: UserRole | undefined): boolean {
  return role !== undefined && ROLES_WITH_PEDAGOGICAL_PROFILE.includes(role)
}

/**
 * Peut-on écrire le profil administratif consulté ?
 *
 * `PUT /profiles/:userId/administrative` : le titulaire, le RP et le TI.
 */
export function canEditAdministrativeProfile(
  role: UserRole | undefined,
  isOwnProfile: boolean,
): boolean {
  if (isOwnProfile) return true
  return role !== undefined && ADMINISTRATIVE_EDITOR_ROLES.includes(role)
}

/**
 * Peut-on changer ou supprimer la photo du profil consulté ?
 *
 * `POST` et `DELETE /profiles/:userId/avatar` sont réservés au **titulaire
 * seul**, sans exception administrative — plus restrictif que l'écriture du bloc
 * administratif, ouverte au RP et au TI : chaque rôle administratif écrit dans
 * son domaine, or la photo n'appartient au domaine d'aucun d'eux
 * (`docs/routes.md`, 2026-08-10). Le TI qui doit neutraliser une photo passe par
 * `POST /admin/visibility-overrides`, pas par un remplacement.
 */
export function canEditProfileAvatar(isOwnProfile: boolean): boolean {
  return isOwnProfile
}

/**
 * Peut-on écrire la section déclarative du profil pédagogique consulté ?
 *
 * `PUT /profiles/:userId/pedagogical` : le titulaire (élève ou formateur), le RP
 * sur un tiers, le TI. Un RP n'écrit pas sa propre section déclarative — il n'a
 * pas de profil pédagogique.
 */
export function canEditDeclarativePedagogicalProfile(
  role: UserRole | undefined,
  isOwnProfile: boolean,
): boolean {
  if (role === undefined) return false
  if (role === 'technicien_informatique') return true
  if (role === 'responsable_pedagogique') return !isOwnProfile
  return isOwnProfile && roleHasPedagogicalProfile(role)
}

/**
 * La prescription reste **rédigée par le responsable pédagogique seul**, y
 * compris quand la cible est l'appelant : un élève ne rédige pas ses
 * préconisations, un formateur pas ses résultats de test.
 */
export function canEditPrescription(role: UserRole | undefined): boolean {
  return role === 'responsable_pedagogique'
}
