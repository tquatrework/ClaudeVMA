import { fetchProfile } from '../../api/profile'
import type {
  AdministrativeProfileFields,
  PedagogicalProfileType,
} from '../../types/profile'
import { useAsyncData } from '../useAsyncData'
import { getProfileReadErrorMessage } from '../../utils/profileErrors'
import {
  pickAdministrativeAvatarUrl,
  pickAdministrativeFields,
} from '../../utils/profileFields'
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
 */
export function useProfileForm(userId: string | undefined): UseProfileFormResult {
  const { data, isLoading, error: loadError } = useAsyncData(
    () => loadProfileFormData(userId),
    [userId],
  )

  const [avatarUrl, setAvatarUrl] = useOwnedAvatarUrl(data, data?.avatarUrl ?? null)

  const saveActions = useProfileSaveActions(userId)

  return {
    administrative: data?.administrative,
    avatarUrl,
    setAvatarUrl,
    pedagogical: data?.pedagogical,
    pedagogicalType: data?.pedagogicalType,
    isLoading,
    loadError,
    ...saveActions,
  }
}
