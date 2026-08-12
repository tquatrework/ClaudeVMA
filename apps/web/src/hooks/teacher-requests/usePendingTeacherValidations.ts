/**
 * usePendingTeacherValidations — file de validation des nouveaux formateurs,
 * chargée **au niveau de la page** (arbitrage du 2026-08-10).
 *
 * La page détient la liste ; les lignes n'appellent pas le serveur pour se
 * connaître. Après une décision, l'enregistrement renvoyé par le serveur remonte
 * ici : la ligne quitte la file quand la décision est terminale, sinon elle
 * change d'état sur place. **Aucun rechargement complet** — recharger effacerait
 * la position de lecture du RP au milieu d'une file de dix-sept dossiers.
 */

import { useCallback, useEffect, useState } from 'react'
import { fetchPendingTeachers } from '../../api/profile'
import type {
  PendingTeacher,
  TeacherValidationRecord,
  TeacherValidationState,
} from '../../types/profile'
import { useAsyncData } from '../useAsyncData'
import { isTerminalValidationState } from '../../utils/teacherValidationLabels'

export interface PendingTeacherRow extends PendingTeacher {
  /** État courant de la ligne : `pending` au chargement, puis ce que le serveur a répondu. */
  status: TeacherValidationState
}

export interface UsePendingTeacherValidationsResult {
  teachers: PendingTeacherRow[]
  isLoading: boolean
  loadError: string | null

  /** Nombre de dossiers encore en attente, décisions de la session déduites. */
  totalPending: number
  page: number
  totalPages: number
  goToPage: (page: number) => void

  /** Remonte la réponse d'une décision : la page est propriétaire de l'état. */
  applyDecision: (teacherId: string, record: TeacherValidationRecord) => void
}

export function usePendingTeacherValidations(): UsePendingTeacherValidationsResult {
  const [page, setPage] = useState(1)
  const [teachers, setTeachers] = useState<PendingTeacherRow[]>([])
  const [totalPending, setTotalPending] = useState(0)

  const { data, isLoading, error } = useAsyncData(() => fetchPendingTeachers(page), [page], {
    fallbackErrorMessage: 'Impossible de charger la file des nouveaux formateurs.',
  })

  useEffect(() => {
    if (!data) return
    setTeachers(data.data.map((teacher) => ({ ...teacher, status: 'pending' as const })))
    setTotalPending(data.total)
  }, [data])

  const applyDecision = useCallback((teacherId: string, record: TeacherValidationRecord) => {
    if (isTerminalValidationState(record.status)) {
      setTeachers((current) => current.filter((teacher) => teacher.userId !== teacherId))
      setTotalPending((current) => Math.max(0, current - 1))
      return
    }
    setTeachers((current) =>
      current.map((teacher) =>
        teacher.userId === teacherId ? { ...teacher, status: record.status } : teacher,
      ),
    )
  }, [])

  const goToPage = useCallback((nextPage: number) => {
    setPage(Math.max(1, nextPage))
  }, [])

  return {
    teachers,
    isLoading,
    loadError: error,
    totalPending,
    page: data?.page ?? page,
    totalPages: data?.totalPages ?? 0,
    goToPage,
    applyDecision,
  }
}
