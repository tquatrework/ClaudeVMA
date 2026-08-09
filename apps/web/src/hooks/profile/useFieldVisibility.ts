/**
 * useFieldVisibility — visibilité champ par champ d'un profil
 * (`GET|PUT /profiles/:userId/field-visibility`).
 *
 * Remplace `useProfileVisibility`, qui interrogeait `visibility-preferences` —
 * route supprimée côté serveur (`404` désormais).
 *
 * Le `GET` renvoie le catalogue complet, défauts compris : ce hook n'invente ni
 * liste de champs ni valeur par défaut. Le `PUT` est un **upsert partiel**, on
 * n'envoie donc que les champs réellement modifiés.
 */

import { useCallback, useState } from 'react'
import { fetchFieldVisibility, updateFieldVisibility } from '../../api/profile'
import type {
  FieldVisibilityEntry,
  FieldVisibilitySettings,
  FieldVisibilityUpdate,
} from '../../types/profile'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

async function loadFieldVisibility(
  userId: string | undefined,
  canAccess: boolean,
): Promise<FieldVisibilitySettings> {
  if (!userId || !canAccess) return pendingForever<FieldVisibilitySettings>()

  try {
    return await fetchFieldVisibility(userId)
  } catch (caughtError) {
    const status = getErrorStatus(caughtError)
    const message =
      status === 403
        ? "Vous n'êtes pas autorisé à consulter ces réglages de confidentialité."
        : status === 404
          ? 'Réglages de confidentialité introuvables pour ce compte.'
          : 'Erreur lors du chargement des réglages de confidentialité'
    throw { response: { data: { message } } }
  }
}

export interface UseFieldVisibilityResult {
  fields: FieldVisibilityEntry[] | undefined
  isLoading: boolean
  loadError: string | null
  /** Envoie uniquement les champs modifiés (upsert partiel). */
  save: (changedFields: FieldVisibilityUpdate[]) => Promise<boolean>
  isSaving: boolean
  saveError: string | null
  /** Réglages renvoyés par le dernier enregistrement réussi, s'il y en a eu un. */
  savedFields: FieldVisibilityEntry[] | null
}

export function useFieldVisibility(
  userId: string | undefined,
  canAccess: boolean,
): UseFieldVisibilityResult {
  const { data, isLoading, error: loadError } = useAsyncData(
    () => loadFieldVisibility(userId, canAccess),
    [userId, canAccess],
  )

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedFields, setSavedFields] = useState<FieldVisibilityEntry[] | null>(null)

  const save = useCallback(
    async (changedFields: FieldVisibilityUpdate[]) => {
      if (!userId) return false
      // Le serveur refuse un tableau vide (`400`) : rien à envoyer = rien à faire.
      if (changedFields.length === 0) return true

      setIsSaving(true)
      setSaveError(null)
      try {
        const updated = await updateFieldVisibility(userId, changedFields)
        setSavedFields(updated.fields)
        return true
      } catch (caughtError) {
        const status = getErrorStatus(caughtError)
        setSaveError(
          status === 403
            ? "Vous n'êtes pas autorisé à modifier ces réglages de confidentialité."
            : getErrorMessage(caughtError, "Erreur lors de l'enregistrement des réglages"),
        )
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [userId],
  )

  return {
    fields: savedFields ?? data?.fields,
    isLoading,
    loadError,
    save,
    isSaving,
    saveError,
    savedFields,
  }
}
