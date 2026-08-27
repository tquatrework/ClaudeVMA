/**
 * useStudentMemo — charge le mémo complet (chapitres + items) d'un élève via
 * la route consolidée `GET /memos/students/:studentId`, qui accepte aussi
 * bien le titulaire que les tiers reliés (formateur, RP/AP coordinateur,
 * parent financeur) ou les administrateurs — un seul chemin de lecture pour
 * `MemoReadOnlyModal`, quel que soit le lecteur.
 *
 * Chargement au montage (règle du 2026-08-10) ; protégé contre une réponse
 * obsolète si `studentId` change avant la fin de la requête.
 */

import { useEffect, useState } from 'react'
import { fetchStudentMemo } from '../../api/pedagogicalLogMemos'
import type { MemoChapter } from '../../types/memo'
import { getMemoLoadErrorMessage } from '../../utils/memo'

export interface UseStudentMemoResult {
  chapters: MemoChapter[] | null
  isLoading: boolean
  error: string | null
}

export function useStudentMemo(studentId: string | null): UseStudentMemoResult {
  const [chapters, setChapters] = useState<MemoChapter[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!studentId) {
      setIsLoading(false)
      return
    }

    let isCancelled = false
    setIsLoading(true)
    setError(null)

    fetchStudentMemo(studentId)
      .then((data) => {
        if (!isCancelled) setChapters(data)
      })
      .catch((caughtError) => {
        if (!isCancelled) setError(getMemoLoadErrorMessage(caughtError))
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [studentId])

  return { chapters, isLoading, error }
}
