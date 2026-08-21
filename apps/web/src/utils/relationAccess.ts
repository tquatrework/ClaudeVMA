/**
 * Point unique de correspondance « nature du lien » → libellé français, et de la
 * question « faut-il proposer les archives pédagogiques de cette personne ? ».
 *
 * ⚠️ Ce fichier ne décide de RIEN côté droit. Le contrôle appartient au serveur —
 * `profile-service` pour les statistiques, `archive-document-service` pour les
 * archives — et un accès refusé y répond `404`, indiscernable d'une absence.
 * Ce qui est porté ici est un choix d'**affichage** : ne pas proposer à un élève
 * les archives de son formateur pour lui servir un écran vide. Proposer une action
 * vouée à l'échec est un défaut d'interface ; la refuser reste l'affaire du serveur.
 *
 * Les quatre natures de lien qui ouvrent les archives sont celles listées par
 * `docs/routes.md` § archive-document-service. L'asymétrie voulue : un élève et son
 * parent voient les **statistiques** du formateur, jamais ses **archives**.
 */

import type { ContactOption } from '../hooks/relations/useMyContacts'
import type { ContactRelation, RelationKind } from '../types/relations'
import type { UserRole } from '../types/user'

/**
 * Libellé de la personne **vue par le lecteur** : « Mon professeur », et non le nom
 * technique du lien. Règle de langue du 2026-08-09 : noms techniques en anglais,
 * tout ce que l'utilisateur lit en français, la correspondance en un seul endroit.
 */
export const RELATION_KIND_LABELS: Record<RelationKind, string> = {
  finance_owner_of_student: 'Mon élève',
  student_of_finance_owner: 'Mon parent financeur',
  teacher_of_student: 'Mon élève',
  student_of_teacher: 'Mon professeur',
  animator_of_teacher: "Formateur que j'anime",
  teacher_of_animator: 'Mon animateur pédagogique',
  coordinator_of_student: 'Élève que je coordonne',
  student_of_coordinator: 'Mon coordinateur pédagogique',
  finance_owner_of_student_of_teacher: 'Professeur de mon élève',
  teacher_of_student_of_finance_owner: 'Parent financeur de mon élève',
}

/**
 * Natures de lien qui ouvrent les **archives pédagogiques** de la personne visée.
 * Les autres n'ouvrent que les statistiques.
 */
const ARCHIVE_OPENING_RELATION_KINDS: readonly RelationKind[] = [
  'teacher_of_student',
  'finance_owner_of_student',
  'animator_of_teacher',
  'coordinator_of_student',
]

/**
 * Rôles administratifs : ils accèdent aux statistiques et aux archives de tout le
 * monde, sans distinction pour l'instant (arbitrage du 2026-08-11).
 * L'animateur pédagogique n'en fait PAS partie : sans lien `animator-teacher`, il
 * ne voit les données de personne.
 */
const ADMINISTRATOR_ROLES: readonly UserRole[] = [
  'responsable_pedagogique',
  'administrateur_financier',
  'technicien_informatique',
]

export function isAdministratorRole(role: UserRole | undefined): boolean {
  return role !== undefined && ADMINISTRATOR_ROLES.includes(role)
}

/** Libellés des liens d'une personne, dédoublonnés et prêts à afficher. */
export function describeRelations(relations: ContactRelation[]): string[] {
  const labels = relations.map((relation) => RELATION_KIND_LABELS[relation.kind] ?? relation.kind)
  return Array.from(new Set(labels))
}

/**
 * Faut-il proposer l'onglet « Archives » pour cette personne ?
 * `true` pour un administrateur quel que soit le lien, sinon seulement si l'une des
 * natures de lien figure dans la liste ci-dessus.
 */
export function canRelationsOpenArchives(
  relations: ContactRelation[],
  viewerRole: UserRole | undefined,
): boolean {
  if (isAdministratorRole(viewerRole)) return true
  return relations.some((relation) => ARCHIVE_OPENING_RELATION_KINDS.includes(relation.kind))
}

/**
 * Natures de lien où l'utilisateur est l'accompagnant d'un élève ou d'un
 * formateur (« Mes élèves », `MyStudentsPage`) — le lien va dans le sens
 * accompagnant → accompagné, l'inverse (mon professeur, mon parent) relève de
 * Contacts.
 */
const SUPERVISED_RELATION_KINDS: readonly RelationKind[] = [
  'teacher_of_student',
  'finance_owner_of_student',
  'coordinator_of_student',
  'animator_of_teacher',
]

export function isSupervisedContact(contact: ContactOption): boolean {
  return contact.relations.some((relation) => SUPERVISED_RELATION_KINDS.includes(relation.kind))
}

/**
 * Sous-ensemble de `SUPERVISED_RELATION_KINDS` où le contact est un **élève**
 * (jamais un formateur, cas d'`animator_of_teacher`) — seules ces natures de
 * lien produisent un `studentId` exploitable par
 * `GET /students/:studentId/pedagogical-log`. Utilisé par le sélecteur
 * d'élève du cahier de texte (`PedagogicalLogPage`).
 */
const STUDENT_LIKE_RELATION_KINDS: readonly RelationKind[] = [
  'teacher_of_student',
  'finance_owner_of_student',
  'coordinator_of_student',
]

export function isStudentLikeContact(contact: ContactOption): boolean {
  return contact.relations.some((relation) => STUDENT_LIKE_RELATION_KINDS.includes(relation.kind))
}
