/**
 * useTerminateTeacherRelation — orchestration de la confirmation « Mettre fin » sur
 * la fiche de l'élève (arbitrage du 2026-08-12, « Fin d'une relation élève↔formateur »).
 *
 * Contrairement à `useFinanceOwnerStudentLinks`, ce hook ne charge rien lui-même : la
 * liste des formateurs liés appartient déjà à la page (`useProfileDetails`), chargée une
 * fois au montage. Ce hook porte uniquement l'action — boîte de confirmation, motif
 * optionnel, appel, et report du résultat au propriétaire de la liste via `onTerminated`
 * (règle du 2026-08-10 : la donnée remonte à la page, pas de rechargement complet).
 */

import { useCallback, useRef, useState } from 'react'
import { unlinkTeacherStudentRelation } from '../../api/relations'
import type { TeacherStudentRelation } from '../../types/profile'
import {
  describeTerminateTeacherRelationFailure,
  TERMINATE_TEACHER_RELATION_REASON_MAX_LENGTH,
} from '../../utils/relationLabels'

export interface UseTerminateTeacherRelationResult {
  /** Relation dont la fin attend confirmation, `null` si aucune boîte n'est ouverte. */
  pendingTermination: TeacherStudentRelation | null
  requestTermination: (relation: TeacherStudentRelation) => void
  cancelTermination: () => void
  reason: string
  setReason: (reason: string) => void
  reasonMaxLength: number
  isTerminating: boolean
  terminationError: string | null
  confirmTermination: () => Promise<void>
}

/**
 * @param onTerminated appelé avec la réponse **du serveur** une fois la relation
 *   terminée, pour que la page retire ce formateur de sa propre liste.
 */
export function useTerminateTeacherRelation(
  onTerminated: (endedRelation: TeacherStudentRelation) => void,
): UseTerminateTeacherRelationResult {
  const [pendingTermination, setPendingTermination] = useState<TeacherStudentRelation | null>(
    null,
  )
  const [reason, setReason] = useState('')
  const [isTerminating, setIsTerminating] = useState(false)
  const [terminationError, setTerminationError] = useState<string | null>(null)

  /**
   * Une fin en vol interdit la suivante. La référence, et non l'état, parce qu'un
   * double clic rapide déclenche les deux appels avant le moindre rendu.
   */
  const isTerminationInFlightRef = useRef(false)

  const requestTermination = useCallback((relation: TeacherStudentRelation) => {
    setTerminationError(null)
    setReason('')
    setPendingTermination(relation)
  }, [])

  const cancelTermination = useCallback(() => {
    if (isTerminationInFlightRef.current) return
    setTerminationError(null)
    setPendingTermination(null)
  }, [])

  const confirmTermination = useCallback(async () => {
    if (!pendingTermination || isTerminationInFlightRef.current) return

    isTerminationInFlightRef.current = true
    setIsTerminating(true)
    setTerminationError(null)

    try {
      const trimmedReason = reason.trim()
      const endedRelation = await unlinkTeacherStudentRelation(
        pendingTermination.teacherId,
        pendingTermination.studentId,
        trimmedReason || undefined,
      )
      onTerminated(endedRelation)
      setPendingTermination(null)
    } catch (error) {
      // La boîte reste ouverte : l'utilisateur voit le refus au lieu de croire la
      // relation terminée.
      setTerminationError(describeTerminateTeacherRelationFailure(error))
    } finally {
      isTerminationInFlightRef.current = false
      setIsTerminating(false)
    }
  }, [pendingTermination, reason, onTerminated])

  return {
    pendingTermination,
    requestTermination,
    cancelTermination,
    reason,
    setReason,
    reasonMaxLength: TERMINATE_TEACHER_RELATION_REASON_MAX_LENGTH,
    isTerminating,
    terminationError,
    confirmTermination,
  }
}
