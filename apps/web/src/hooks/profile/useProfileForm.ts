import { useCallback } from 'react'
import { fetchProfile } from '../../api/profile'
import type {
  AdministrativeProfileFields,
  PedagogicalProfileType,
  SavedProfileBlock,
} from '../../types/profile'
import { useAsyncData } from '../useAsyncData'
import { useOwnedValue } from '../useOwnedValue'
import { getProfileReadErrorMessage } from '../../utils/profileErrors'
import {
  pickAdministrativeAvatarUrl,
  pickAdministrativeFields,
} from '../../utils/profileFields'
import { mergeSavedProfileBlock } from '../../utils/profileMerge'
import { useOwnedAvatarUrl } from './useOwnedAvatarUrl'
import {
  useProfileSaveActions,
  type UseProfileSaveActionsResult,
} from './useProfileSaveActions'

interface ProfileFormData {
  administrative: AdministrativeProfileFields
  /**
   * URL de lecture versionnée de la photo, **hors** des champs éditables : elle
   * est posée par le serveur et l'envoyer au `PUT` vaut `400`. Elle est exposée à
   * part pour que l'écran puisse afficher la photo sans jamais la réécrire.
   */
  avatarUrl: string | null
  /**
   * Bloc `pedagogical` brut de `GET /profiles/:userId` : sections déclarative et
   * prescription confondues, à plat. La séparation est faite au moment de
   * l'écriture, chaque section ayant sa route.
   * `null` = profil pédagogique jamais renseigné, état NORMAL.
   */
  pedagogical: Record<string, unknown> | null
  /** Forme annoncée par le serveur, `null` tant qu'aucun profil n'existe. */
  pedagogicalType: PedagogicalProfileType | null
}

function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

async function loadProfileFormData(userId: string | undefined): Promise<ProfileFormData> {
  if (!userId) return pendingForever<ProfileFormData>()

  try {
    const profile = await fetchProfile(userId)
    return {
      // `administrative` / `pedagogical` : clés courtes de GET /profiles/:userId.
      // Le bloc administratif est filtré sur les champs réacceptés en écriture :
      // le formulaire le renvoie intégralement au PUT, et tout champ inconnu y
      // déclencherait un 400 (forbidNonWhitelisted).
      administrative: pickAdministrativeFields(profile.administrative),
      avatarUrl: pickAdministrativeAvatarUrl(profile.administrative),
      pedagogical: (profile.pedagogical ?? null) as Record<string, unknown> | null,
      pedagogicalType: profile.pedagogicalType ?? null,
    }
  } catch (caughtError) {
    throw { response: { data: { message: getProfileReadErrorMessage(caughtError) } } }
  }
}

export interface UseProfileFormResult extends UseProfileSaveActionsResult {
  administrative: AdministrativeProfileFields | undefined
  avatarUrl: string | null
  pedagogical: Record<string, unknown> | null | undefined
  pedagogicalType: PedagogicalProfileType | null | undefined
  isLoading: boolean
  loadError: string | null
  /**
   * Enregistre la nouvelle `avatarUrl` — celle que le serveur vient de renvoyer
   * après un envoi, `null` après une suppression. L'écran est propriétaire de
   * cette donnée : la laisser au champ photo la ferait disparaître au premier
   * démontage (correction du 2026-08-10).
   */
  setAvatarUrl: (nextAvatarUrl: string | null) => void
}

/**
 * useProfileForm — charge les données initiales du profil administratif et
 * pédagogique d'un utilisateur, et expose trois actions de sauvegarde
 * indépendantes, une par route d'écriture : administratif, section déclarative
 * du pédagogique, section prescription (RP seul).
 *
 * Chaque action a son propre cycle loading/error : un `403` sur la prescription
 * ne doit pas faire croire que l'enregistrement du profil déclaratif a échoué.
 *
 * Les données affichées sont **détenues par l'écran** : un enregistrement y fait
 * entrer la réponse du serveur, sans relecture. Jusqu'au 2026-08-10, ces réponses
 * étaient jetées et l'écran restait sur les valeurs d'avant — `filledBy` et
 * `filledAt`, posés côté serveur, n'apparaissaient qu'au rechargement suivant.
 */
export function useProfileForm(userId: string | undefined): UseProfileFormResult {
  const { data, isLoading, error: loadError } = useAsyncData(
    () => loadProfileFormData(userId),
    [userId],
  )

  const [ownedData, setOwnedData] = useOwnedValue(data, data)

  /**
   * Resynchronisée sur le **chargement** (`data`), jamais sur les données
   * détenues : un enregistrement de champs ne doit pas ramener la photo d'avant
   * le dernier envoi.
   */
  const [avatarUrl, setAvatarUrl] = useOwnedAvatarUrl(data, data?.avatarUrl ?? null)

  const applySavedAdministrative = useCallback(
    (savedBlock: SavedProfileBlock) => {
      setOwnedData((previous) => {
        if (!previous) return previous
        // Refiltré sur les champs réacceptés en écriture : la réponse porte aussi
        // `userId`, la traçabilité et `avatarUrl`, que le formulaire renverrait
        // au `PUT` — et qui vaudraient `400`.
        const administrative = pickAdministrativeFields(
          mergeSavedProfileBlock(previous.administrative, savedBlock),
        )
        return { ...previous, administrative }
      })
    },
    [setOwnedData],
  )

  /**
   * Déclaratif et prescription visent le **même** bloc `pedagogical`, renvoyé à
   * plat par le serveur : la fusion vaut pour les deux routes, et c'est elle qui
   * fait apparaître `filledBy`/`filledAt` sans rechargement.
   */
  const applySavedPedagogical = useCallback(
    (savedBlock: SavedProfileBlock) => {
      setOwnedData((previous) => {
        if (!previous) return previous
        const pedagogical = mergeSavedProfileBlock(previous.pedagogical, savedBlock)
        return pedagogical === previous.pedagogical ? previous : { ...previous, pedagogical }
      })
    },
    [setOwnedData],
  )

  const saveActions = useProfileSaveActions(userId, {
    onAdministrativeSaved: applySavedAdministrative,
    onPedagogicalSaved: applySavedPedagogical,
    onPrescriptionSaved: applySavedPedagogical,
  })

  return {
    administrative: ownedData?.administrative,
    avatarUrl,
    setAvatarUrl,
    pedagogical: ownedData?.pedagogical,
    pedagogicalType: ownedData?.pedagogicalType,
    isLoading,
    loadError,
    ...saveActions,
  }
}
