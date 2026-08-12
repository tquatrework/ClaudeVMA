import apiClient from './client'
import type { TeacherStudentRelation } from '../types/profile'
import type { FinanceOwnerStudentLink, MyContact } from '../types/relations'

/**
 * GET /relations/my-contacts — les personnes auxquelles l'utilisateur AUTHENTIFIÉ
 * est relié, tous rôles confondus, avec prénom, nom et nature du lien.
 *
 * Aucun paramètre d'identifiant : il n'y a rien à falsifier, et on ne renvoie jamais
 * les relations d'un tiers. C'est la source unique des écrans qui font choisir « qui
 * consulter ? » — un formateur y trouve ses élèves, un AP les formateurs qu'il anime,
 * un parent ses élèves ET les professeurs de ses élèves (lien indirect).
 *
 * À préférer à `fetchLinkedStudents`, qui n'interroge que la table financeur↔élève et
 * répond donc `200 []` — une liste vide, jamais un refus — à un formateur.
 * Un compte sans aucun lien reçoit `200 []`.
 */
export async function fetchMyContacts(): Promise<MyContact[]> {
  const { data } = await apiClient.get<MyContact[]>('/relations/my-contacts')
  return data
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

/**
 * DELETE /relations/finance-owner-student/:financeOwnerId/:studentId — « Délier »
 * un parent financeur et un élève, depuis l'un ou l'autre côté.
 *
 * Aucun corps de requête. **Aucune ligne n'est supprimée** malgré le verbe : la
 * rupture renseigne `endedAt`/`endedBy`, la table reste un journal. L'appel est
 * **idempotent** — deux appels renvoient `200` avec la **même** date de rupture.
 *
 * Le `404` couvre **deux cas volontairement indiscernables** : lien inexistant, et
 * appelant sans droit sur ce lien. Un `403` révélerait à un tiers qui finance qui.
 * Ne jamais écrire de message qui suppose l'une des deux causes.
 *
 * La réponse est la seule source de vérité de ce qui s'est passé : c'est elle, et
 * non le corps envoyé, qui doit alimenter l'écran (règle du 2026-08-10).
 */
export async function unlinkFinanceOwnerAndStudent(
  financeOwnerId: string,
  studentId: string,
): Promise<FinanceOwnerStudentLink> {
  const { data } = await apiClient.delete<FinanceOwnerStudentLink>(
    `/relations/finance-owner-student/${financeOwnerId}/${studentId}`,
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
