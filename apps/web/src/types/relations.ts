/**
 * Types partagés — relations métier entre personnes (profile-service).
 *
 * Source unique : `GET /relations/my-contacts`, qui renvoie pour l'utilisateur
 * AUTHENTIFIÉ les personnes auxquelles il est relié, avec leur prénom, leur nom et
 * la **nature** du lien. Aucun paramètre d'identifiant : on ne demande jamais les
 * relations d'un tiers.
 *
 * Les valeurs de `kind` sont orientées **lecteur → cible** : `student_of_teacher`
 * se lit « cette personne est le professeur du lecteur ». Le sens porte l'essentiel
 * du droit — un élève voit les statistiques de son formateur mais pas ses archives
 * pédagogiques —, il ne doit donc jamais être réduit à un booléen côté front.
 *
 * `userId` n'est là que pour construire l'appel suivant : il n'est jamais affiché
 * (arbitrage du 2026-08-09, aucun UUID à l'écran).
 */

export type RelationKind =
  | 'finance_owner_of_student'
  | 'student_of_finance_owner'
  | 'teacher_of_student'
  | 'student_of_teacher'
  | 'animator_of_teacher'
  | 'teacher_of_animator'
  | 'coordinator_of_student'
  | 'student_of_coordinator'
  | 'finance_owner_of_student_of_teacher'
  | 'teacher_of_student_of_finance_owner'

export interface ContactRelation {
  kind: RelationKind
  /** Présent sur les liens formateur↔élève uniquement. */
  isPrincipalTeacher?: boolean
  /** Personnes par lesquelles passe un lien indirect (parent ↔ formateur de son élève). */
  throughUserIds?: string[]
}

export interface MyContact {
  userId: string
  /** `null` quand la personne n'a pas de profil administratif — état normal. */
  firstName: string | null
  lastName: string | null
  relations: ContactRelation[]
}
