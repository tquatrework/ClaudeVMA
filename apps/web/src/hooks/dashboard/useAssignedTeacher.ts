import { fetchTeacherStudentRelations } from '../../api/relations'
import type { TeacherStudentRelation } from '../../types/profile'
import { useAsyncData } from '../useAsyncData'

export interface UseAssignedTeacherResult {
  /** Le professeur assigné à l'élève, `null` tant qu'aucune relation active n'existe. */
  assignedTeacher: TeacherStudentRelation | null
  isLoadingTeacher: boolean
  teacherError: string | null
}

/**
 * useAssignedTeacher — le professeur assigné à un élève, résolu depuis la relation
 * élève↔formateur de `profile-service` (`GET /relations/teacher-student/:studentId`,
 * docs/routes.md § profile-service > Relations), qui en est l'unique propriétaire
 * (arbitrage du 2026-08-12, « Flow de la demande de professeur »).
 *
 * Source volontairement différente de `useDashboardContacts` (`GET /contacts` de
 * communication-service) : cette dernière liste des contacts autorisés, pas
 * l'affectation pédagogique réelle créée par le RP à la validation d'une demande.
 * Le nom du formateur est déjà résolu côté serveur (`teacherName`) — jamais d'appel
 * supplémentaire pour éviter d'afficher un UUID.
 *
 * Ne renvoie que les relations **actives** : une relation terminée par le RP
 * (arbitrage du 2026-08-12, « Fin d'une relation élève↔formateur ») n'y figure
 * plus, et l'élève redevient donc sans professeur assigné.
 */
export function useAssignedTeacher(studentId: string | undefined): UseAssignedTeacherResult {
  const { data, isLoading, error } = useAsyncData(
    () => (studentId ? fetchTeacherStudentRelations(studentId) : Promise.resolve([])),
    [studentId],
    { fallbackErrorMessage: 'Impossible de charger le professeur assigné' },
  )

  const relations = data ?? []
  // Le professeur principal prime s'il est marqué comme tel ; à défaut, la seule
  // (ou la première) relation active sert de professeur affiché.
  const assignedTeacher =
    relations.find((relation) => relation.isPrincipalTeacher) ?? relations[0] ?? null

  return {
    assignedTeacher,
    isLoadingTeacher: isLoading,
    teacherError: error,
  }
}
