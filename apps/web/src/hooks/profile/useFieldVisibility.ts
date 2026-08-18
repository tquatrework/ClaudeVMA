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
 *
 * Le catalogue porte les DEUX blocs pédagogiques (élève et formateur) : c'est à
 * l'appelant de ne retenir que celui du rôle réel du titulaire du profil
 * (arbitrage du 2026-08-17, `docs/architecture.md`). Ce hook fournit donc aussi,
 * en parallèle, `pedagogicalType` et `pedagogicalBlock` — lus sur
 * `GET /profiles/:userId`, la **même** source que `ProfilePage`/`ProfileEditPage`
 * pour résoudre `resolvePedagogicalProfileKind` (`src/utils/profileFields.ts`) —
 * plutôt que de deviner depuis le rôle de l'appelant, qui n'est pas forcément
 * celui du titulaire consulté (RP/TI/AF sur la fiche d'un tiers).
 */

import { useCallback, useState } from 'react'
import { fetchFieldVisibility, fetchProfile, updateFieldVisibility } from '../../api/profile'
import type {
  FieldVisibilityEntry,
  FieldVisibilityUpdate,
  PedagogicalProfileType,
} from '../../types/profile'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

interface FieldVisibilityLoadResult {
  fields: FieldVisibilityEntry[]
  /** `GET /profiles/:userId` → `pedagogicalType`, source autoritative du rôle pédagogique. */
  pedagogicalType: PedagogicalProfileType | null | undefined
  /** `GET /profiles/:userId` → `pedagogical`, repli de `resolvePedagogicalProfileKind`. */
  pedagogicalBlock: unknown
}

async function loadFieldVisibility(
  userId: string | undefined,
  canAccess: boolean,
): Promise<FieldVisibilityLoadResult> {
  if (!userId || !canAccess) return pendingForever<FieldVisibilityLoadResult>()

  try {
    const [settings, profile] = await Promise.all([
      fetchFieldVisibility(userId),
      fetchProfile(userId),
    ])
    return {
      fields: settings.fields,
      pedagogicalType: profile.pedagogicalType,
      pedagogicalBlock: profile.pedagogical,
    }
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
  /** Rôle pédagogique réel du titulaire consulté — voir `resolvePedagogicalProfileKind`. */
  pedagogicalType: PedagogicalProfileType | null | undefined
  pedagogicalBlock: unknown
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
    pedagogicalType: data?.pedagogicalType,
    pedagogicalBlock: data?.pedagogicalBlock,
    isLoading,
    loadError,
    save,
    isSaving,
    saveError,
    savedFields,
  }
}
