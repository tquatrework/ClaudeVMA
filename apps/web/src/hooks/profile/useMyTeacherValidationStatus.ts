import { fetchTeacherValidationStatus } from '../../api/profile'
import type { TeacherValidationRecord } from '../../types/profile'
import { useAsyncData } from '../useAsyncData'
import { useAuth } from '../useAuth'

/** Ne se résout jamais — utilisé pour ne rien charger tant que la donnée ne concerne pas ce compte. */
function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

export interface UseMyTeacherValidationStatusResult {
  validationRecord: TeacherValidationRecord | null
  isLoadingValidationStatus: boolean
}

/**
 * useMyTeacherValidationStatus — un formateur lit son PROPRE enregistrement de
 * validation (profile-service), pour s'afficher son propre statut (arbitrage
 * du 2026-08-13, `docs/architecture.md` > « Visibilité du statut de validation,
 * côté formateur »).
 *
 * Vérifié contre la pile réelle le 2026-08-13 : `GET /profiles/:teacherId/validation`
 * répond `200` à un formateur qui lit sa propre ligne (pas de `403`) — la même
 * route que `TeacherValidationPanel` (RP/TI), même forme de réponse.
 *
 * N'appelle jamais l'API pour un autre rôle que `formateur` : ce statut n'existe
 * que pour les comptes formateur, et un `animateur_pedagogique` (déjà validé
 * pour être promu) n'a pas besoin de le consulter.
 */
export function useMyTeacherValidationStatus(): UseMyTeacherValidationStatusResult {
  const { user } = useAuth()
  const isTeacher = user?.role === 'formateur'
  const teacherId = user?.id

  const { data, isLoading } = useAsyncData<TeacherValidationRecord | null>(
    async () => {
      if (!isTeacher || !teacherId) return pendingForever<TeacherValidationRecord | null>()
      try {
        return (await fetchTeacherValidationStatus(teacherId)) ?? null
      } catch {
        return null
      }
    },
    [isTeacher, teacherId],
  )

  return {
    validationRecord: isTeacher ? (data ?? null) : null,
    isLoadingValidationStatus: isTeacher ? isLoading : false,
  }
}
