import apiClient from './client'
import type { PersonName, TeacherStudentRelation } from '../types/profile'

/**
 * Lien financeur ↔ élève, tel que renvoyé par les deux routes de relations.
 *
 * Les deux routes renvoient **déjà** le nom de l'autre partie, résolu côté serveur
 * depuis son profil administratif (docs/routes.md § profile-service > Relations) :
 *   - `by-student/:studentId`   → `financeOwnerName`
 *   - `:financeOwnerId`         → `studentName`
 *
 * Ces champs sont la SEULE source du nom à afficher. Ne jamais les ré-enrichir via
 * `GET /profiles/:id` : un élève n'a pas le droit de lire le profil de son parent
 * (403 « An élève may only view their own profile »), ce qui faisait autrefois
 * retomber l'affichage sur l'UUID. Un seul appel réseau, pas de N+1.
 *
 * `financeOwnerName`/`studentName` valent `null` si la personne n'a pas de profil
 * administratif — cas normal, à afficher comme un repli lisible, jamais comme un UUID.
 */
export interface FinanceOwnerStudentLink {
  financeOwnerId: string
  studentId: string
  createdAt: string
  /** Présent sur `GET /relations/finance-owner-student/by-student/:studentId`. */
  financeOwnerName?: PersonName | null
  /** Présent sur `GET /relations/finance-owner-student/:financeOwnerId`. */
  studentName?: PersonName | null
}

/**
 * Vue partielle de la réponse de `GET /profiles/:userId`, limitée aux champs
 * utilisés pour afficher un nom lisible (règle UX : jamais d'UUID à l'écran).
 *
 * Mêmes clés courtes que `Profile` (`administrative` / `pedagogical`) : c'est
 * bien le même endpoint, appelé ici via `fetchStudentProfile`.
 */
export interface StudentProfile {
  userId: string
  loginIdentifier: string | null
  administrative?: {
    firstName?: string
    lastName?: string
  } | null
  pedagogical?: {
    /** Niveau scolaire de l'élève — `level`, pas `niveauScolaire` (docs/routes.md). */
    level?: string
  } | null
}

export async function fetchLinkedStudents(financeOwnerId: string): Promise<FinanceOwnerStudentLink[]> {
  const { data } = await apiClient.get<FinanceOwnerStudentLink[]>(
    `/relations/finance-owner-student/${financeOwnerId}`,
  )
  return data
}

/** Lister les parents financeurs rattachés à un élève */
export async function fetchLinkedParents(studentId: string): Promise<FinanceOwnerStudentLink[]> {
  const { data } = await apiClient.get<FinanceOwnerStudentLink[]>(
    `/relations/finance-owner-student/by-student/${studentId}`,
  )
  return data
}

export async function fetchStudentProfile(studentId: string): Promise<StudentProfile> {
  const { data } = await apiClient.get<StudentProfile>(`/profiles/${studentId}`)
  return data
}

/**
 * GET /relations/teacher-student/:studentId — Lister les formateurs liés à un élève
 *
 * Écart : cette route n'apparaît pas dans docs/routes.md, qui documente uniquement
 * `POST /relations/teacher-student`. Reproduite ici à l'identique du comportement
 * préexistant — non corrigée dans ce lot structurel.
 */
export async function fetchTeacherStudentRelations(
  studentId: string,
): Promise<TeacherStudentRelation[]> {
  const { data } = await apiClient.get<TeacherStudentRelation[]>(
    `/relations/teacher-student/${studentId}`,
  )
  return data
}
