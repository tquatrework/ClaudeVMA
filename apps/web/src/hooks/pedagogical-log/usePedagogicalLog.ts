/**
 * usePedagogicalLog — cahier de texte d'un élève donné.
 *
 * Chargement au niveau de la page (montage + changement d'élève ou de plage de
 * dates), jamais à chaque interaction locale (règle de chargement du
 * 2026-08-10). Les créations/modifications réaffichent directement la réponse
 * du serveur — jamais le corps envoyé — et repositionnent localement l'entrée
 * dans la liste via `sortPedagogicalLogEntries` plutôt que de redemander la
 * liste complète au serveur.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  createStudentLogEntry,
  deleteLogEntry,
  fetchStudentPedagogicalLog,
  updateLogEntry,
  type FetchStudentLogParams,
  type LogEntryPayload,
  type PedagogicalLogPage,
} from '../../api/pedagogicalLog'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'
import { sortPedagogicalLogEntries } from '../../utils/pedagogicalLogSort'
import { useAsyncData } from '../useAsyncData'

const LOAD_FALLBACK_MESSAGE = 'Impossible de charger le cahier de texte.'
const CREATE_FALLBACK_MESSAGE = "L'entrée n'a pas pu être créée."
const UPDATE_FALLBACK_MESSAGE = "L'entrée n'a pas pu être modifiée."
const DELETE_FALLBACK_MESSAGE = "L'entrée n'a pas pu être supprimée."

async function loadStudentLog(
  studentId: string,
  params: FetchStudentLogParams,
): Promise<PedagogicalLogPage[]> {
  if (!studentId) return []
  try {
    return await fetchStudentPedagogicalLog(studentId, params)
  } catch (caughtError: unknown) {
    const status = getErrorStatus(caughtError)
    throw {
      response: {
        status,
        data: { message: status === 403 ? 'Accès refusé' : LOAD_FALLBACK_MESSAGE },
      },
    }
  }
}

export interface UsePedagogicalLogResult {
  entries: PedagogicalLogPage[]
  isLoading: boolean
  errorMessage: string | null
  dismissError: () => void

  createEntry: (payload: LogEntryPayload) => Promise<boolean>
  isCreating: boolean
  createError: string | null
  dismissCreateError: () => void

  updateEntry: (logId: string, payload: LogEntryPayload) => Promise<boolean>
  updatingLogId: string | null
  updateError: string | null
  dismissUpdateError: () => void

  deleteEntry: (logId: string) => Promise<boolean>
  deletingLogId: string | null
  deleteError: string | null
  dismissDeleteError: () => void

  /** Insère localement une page créée par un autre flux (page spéciale RP). */
  addLocalEntry: (entry: PedagogicalLogPage) => void
}

export function usePedagogicalLog(
  studentId: string,
  params: FetchStudentLogParams,
): UsePedagogicalLogResult {
  const { data, isLoading, error } = useAsyncData(
    () => loadStudentLog(studentId, params),
    [studentId, params.from, params.to],
    { fallbackErrorMessage: LOAD_FALLBACK_MESSAGE },
  )

  const [entriesOverride, setEntriesOverride] = useState<PedagogicalLogPage[] | null>(null)
  const [isErrorDismissed, setIsErrorDismissed] = useState(false)

  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [updatingLogId, setUpdatingLogId] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const [deletingLogId, setDeletingLogId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    setEntriesOverride(null)
  }, [data])

  useEffect(() => {
    setIsErrorDismissed(false)
  }, [error])

  const entries = entriesOverride ?? data ?? []

  const createEntry = useCallback(
    async (payload: LogEntryPayload): Promise<boolean> => {
      if (!studentId) return false
      setIsCreating(true)
      setCreateError(null)
      try {
        const created = await createStudentLogEntry(studentId, payload)
        setEntriesOverride(sortPedagogicalLogEntries([created, ...(entriesOverride ?? data ?? [])]))
        return true
      } catch (caughtError: unknown) {
        setCreateError(getErrorMessage(caughtError, CREATE_FALLBACK_MESSAGE))
        return false
      } finally {
        setIsCreating(false)
      }
    },
    [studentId, data, entriesOverride],
  )

  const updateEntry = useCallback(
    async (logId: string, payload: LogEntryPayload): Promise<boolean> => {
      setUpdatingLogId(logId)
      setUpdateError(null)
      try {
        const updated = await updateLogEntry(logId, payload)
        const base = entriesOverride ?? data ?? []
        setEntriesOverride(
          sortPedagogicalLogEntries(base.map((entry) => (entry.id === logId ? updated : entry))),
        )
        return true
      } catch (caughtError: unknown) {
        setUpdateError(getErrorMessage(caughtError, UPDATE_FALLBACK_MESSAGE))
        return false
      } finally {
        setUpdatingLogId(null)
      }
    },
    [data, entriesOverride],
  )

  const deleteEntry = useCallback(
    async (logId: string): Promise<boolean> => {
      setDeletingLogId(logId)
      setDeleteError(null)
      try {
        await deleteLogEntry(logId)
        const base = entriesOverride ?? data ?? []
        setEntriesOverride(base.filter((entry) => entry.id !== logId))
        return true
      } catch (caughtError: unknown) {
        setDeleteError(getErrorMessage(caughtError, DELETE_FALLBACK_MESSAGE))
        return false
      } finally {
        setDeletingLogId(null)
      }
    },
    [data, entriesOverride],
  )

  const addLocalEntry = useCallback(
    (entry: PedagogicalLogPage) => {
      setEntriesOverride(sortPedagogicalLogEntries([entry, ...(entriesOverride ?? data ?? [])]))
    },
    [data, entriesOverride],
  )

  return {
    entries,
    isLoading,
    errorMessage: isErrorDismissed ? null : error,
    dismissError: () => setIsErrorDismissed(true),

    createEntry,
    isCreating,
    createError,
    dismissCreateError: () => setCreateError(null),

    updateEntry,
    updatingLogId,
    updateError,
    dismissUpdateError: () => setUpdateError(null),

    deleteEntry,
    deletingLogId,
    deleteError,
    dismissDeleteError: () => setDeleteError(null),

    addLocalEntry,
  }
}
