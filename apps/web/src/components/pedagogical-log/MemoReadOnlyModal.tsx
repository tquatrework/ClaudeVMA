/**
 * MemoReadOnlyModal — `DraggableModal` + `MemoReadOnlyContent`, alimentée par
 * la route consolidée `GET /memos/students/:studentId` (F1/F5 du chantier
 * Mémo). Utilisée à la fois par `MyStudentsPage` (« Voir le mémo », tiers
 * relié) et `VideoPage` (l'élève consultant son propre mémo pendant une
 * session) — un seul composant, un seul chemin de lecture.
 */

import React from 'react'
import { DraggableModal } from '../ui/DraggableModal'
import { MemoReadOnlyContent } from './MemoReadOnlyContent'
import { useStudentMemo } from '../../hooks/pedagogical-log/useStudentMemo'

interface MemoReadOnlyModalProps {
  studentId: string
  onClose: () => void
  /** Personnalise le titre affiché — ex. « Mémo de Camille Durand ». Par défaut « Mémo ». */
  title?: string
  /** Préselectionne un chapitre (lien « Détacher » posé sur un chapitre précis). */
  initialChapterId?: string | null
}

export function MemoReadOnlyModal({
  studentId,
  onClose,
  title = 'Mémos',
  initialChapterId = null,
}: MemoReadOnlyModalProps) {
  const { chapters, isLoading, error } = useStudentMemo(studentId)

  return (
    <DraggableModal title={title} onClose={onClose}>
      <MemoReadOnlyContent
        chapters={chapters}
        isLoading={isLoading}
        error={error}
        initialChapterId={initialChapterId}
      />
    </DraggableModal>
  )
}
