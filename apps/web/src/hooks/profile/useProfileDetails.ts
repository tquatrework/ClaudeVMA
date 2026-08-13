import { useCallback, useEffect, useMemo, useState } from 'react'
import { createInternalNote, fetchInternalNotes, fetchProfile } from '../../api/profile'
import { fetchTeacherStudentRelations } from '../../api/relations'
import type {
  InternalNote,
  Profile,
  SavedProfileBlock,
  TeacherStudentRelation,
} from '../../types/profile'
import { useAsyncData } from '../useAsyncData'
import { useOwnedValue } from '../useOwnedValue'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'
import { pickAdministrativeAvatarUrl } from '../../utils/profileFields'
import { mergeSavedProfileBlock } from '../../utils/profileMerge'
import { useOwnedAvatarUrl } from './useOwnedAvatarUrl'

interface ProfileDetailsData {
  profile: Profile
  teacherRelations: TeacherStudentRelation[]
  internalNotes: InternalNote[]
}

/**
 * Ne résout jamais — reproduit le comportement préexistant de ProfilePage quand
 * `userId` n'est pas encore disponible (route non résolue) : la page restait
 * indéfiniment sur l'état "Chargement…" plutôt que d'afficher une erreur.
 */
function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

async function loadProfileDetails(
  userId: string | undefined,
  canSeeRelations: boolean,
  canSeeInternalNotes: boolean,
): Promise<ProfileDetailsData> {
  if (!userId) return pendingForever<ProfileDetailsData>()

  let profile: Profile
  try {
    profile = await fetchProfile(userId)
  } catch (caughtError) {
    const status = getErrorStatus(caughtError)
    const message =
      status === 403
        ? 'Accès refusé'
        : status === 404
          ? 'Profil introuvable'
          : 'Erreur lors du chargement du profil'
    // Forme reconnue en priorité par getErrorMessage (response.data.message) afin de
    // reproduire exactement les messages historiques de ProfilePage selon le statut HTTP.
    throw { response: { data: { message } } }
  }

  const [teacherRelations, internalNotes] = await Promise.all([
    canSeeRelations ? fetchTeacherStudentRelations(userId).catch(() => []) : Promise.resolve([]),
    canSeeInternalNotes ? fetchInternalNotes(userId).catch(() => []) : Promise.resolve([]),
  ])

  return { profile, teacherRelations, internalNotes }
}

export interface UseProfileDetailsResult {
  profile: Profile | null
  teacherRelations: TeacherStudentRelation[]
  internalNotes: InternalNote[]
  isLoading: boolean
  loadError: string | null
  addNote: (content: string) => Promise<boolean>
  isSavingNote: boolean
  noteSaveError: string | null
  /**
   * `avatarUrl` du bloc administratif, **détenue par la fiche**. La photo a ses
   * propres routes d'écriture : après un envoi, la valeur qui fait foi est celle
   * renvoyée par le serveur, pas celle du chargement initial.
   */
  avatarUrl: string | null
  /** Enregistre la nouvelle `avatarUrl` (envoi réussi, ou `null` après suppression). */
  setAvatarUrl: (nextAvatarUrl: string | null) => void
  /**
   * Applique à la fiche le bloc administratif **renvoyé par le serveur** après un
   * enregistrement. Aucune relecture : la réponse du `PUT` porte déjà la
   * ressource à jour.
   */
  applySavedAdministrative: (savedBlock: SavedProfileBlock) => void
  /**
   * Applique à la fiche la section déclarative renvoyée par le serveur. Fusionnée
   * dans le bloc `pedagogical`, qui porte aussi la prescription : la remplacer
   * effacerait les préconisations du RP à l'écran.
   */
  applySavedPedagogical: (savedBlock: SavedProfileBlock) => void
  /**
   * Retire un formateur de la liste affichée après la fin de la relation
   * (`DELETE /relations/teacher-student/:teacherId/:studentId`, RP uniquement,
   * arbitrage du 2026-08-12). La réponse du serveur fait foi — c'est elle qui
   * nomme la relation à retirer, sans nouvelle requête (règle du 2026-08-10).
   */
  removeTeacherRelation: (endedRelation: TeacherStudentRelation) => void
}

/**
 * useProfileDetails — charge en une fois le profil, les formateurs liés (si
 * autorisé) et les notes internes (si autorisé), à l'image du chargement combiné
 * (Promise.allSettled) de l'ancienne ProfilePage. Les échecs de chargement des
 * relations et des notes restent non-bloquants (tableaux vides), seule l'échec
 * du profil produit une erreur affichée.
 *
 * `addNote` met à jour la liste localement (préfixe optimiste) plutôt que de
 * recharger l'ensemble, pour reproduire le comportement préexistant.
 */
export function useProfileDetails(
  userId: string | undefined,
  canSeeRelations: boolean,
  canSeeInternalNotes: boolean,
): UseProfileDetailsResult {
  const { data, isLoading, error: loadError } = useAsyncData(
    () => loadProfileDetails(userId, canSeeRelations, canSeeInternalNotes),
    [userId, canSeeRelations, canSeeInternalNotes],
  )

  /**
   * La fiche affichée est **détenue par la page**, pas relue à chaque besoin :
   * un chargement la remplace, un enregistrement y fait entrer la réponse du
   * serveur. Sans cela, les valeurs d'avant l'enregistrement restaient à l'écran
   * (photo comprise jusqu'au 2026-08-10, puis tous les autres champs).
   */
  const [profile, setProfile] = useOwnedValue<Profile | null>(data, data?.profile ?? null)

  /**
   * L'`avatarUrl` reste resynchronisée sur le **chargement** (`data`), jamais sur
   * la fiche détenue : un enregistrement de champs administratifs ne doit pas
   * ramener la photo d'avant le dernier envoi.
   */
  const [avatarUrl, setAvatarUrl] = useOwnedAvatarUrl(
    data,
    pickAdministrativeAvatarUrl(data?.profile.administrative),
  )

  const applySavedAdministrative = useCallback(
    (savedBlock: SavedProfileBlock) => {
      setProfile((previous) => {
        if (!previous) return previous
        const administrative = mergeSavedProfileBlock(previous.administrative, savedBlock)
        return administrative === previous.administrative
          ? previous
          : { ...previous, administrative }
      })
    },
    [setProfile],
  )

  const applySavedPedagogical = useCallback(
    (savedBlock: SavedProfileBlock) => {
      setProfile((previous) => {
        if (!previous) return previous
        const pedagogical = mergeSavedProfileBlock(previous.pedagogical, savedBlock)
        return pedagogical === previous.pedagogical ? previous : { ...previous, pedagogical }
      })
    },
    [setProfile],
  )

  /**
   * Les formateurs liés sont **détenus par la fiche**, comme le profil : le
   * chargement fait autorité au montage, une fin de relation retire ensuite la
   * ligne concernée sans passer par une nouvelle requête.
   */
  const [teacherRelations, setTeacherRelations] = useOwnedValue<TeacherStudentRelation[]>(
    data,
    data?.teacherRelations ?? [],
  )

  const removeTeacherRelation = useCallback(
    (endedRelation: TeacherStudentRelation) => {
      setTeacherRelations((previous) =>
        previous.filter(
          (relation) =>
            !(
              relation.teacherId === endedRelation.teacherId &&
              relation.studentId === endedRelation.studentId
            ),
        ),
      )
    },
    [setTeacherRelations],
  )

  const [addedNotes, setAddedNotes] = useState<InternalNote[]>([])
  useEffect(() => {
    setAddedNotes([])
  }, [userId])

  const internalNotes = useMemo(
    () => [...addedNotes, ...(data?.internalNotes ?? [])],
    [addedNotes, data],
  )

  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteSaveError, setNoteSaveError] = useState<string | null>(null)

  const addNote = useCallback(
    async (content: string) => {
      if (!userId) return false
      setIsSavingNote(true)
      setNoteSaveError(null)
      try {
        const note = await createInternalNote(userId, content)
        setAddedNotes((previous) => [note, ...previous])
        return true
      } catch (caughtError) {
        setNoteSaveError(getErrorMessage(caughtError, "Erreur lors de l'ajout de la note"))
        return false
      } finally {
        setIsSavingNote(false)
      }
    },
    [userId],
  )

  return {
    profile,
    teacherRelations,
    internalNotes,
    isLoading,
    loadError,
    addNote,
    isSavingNote,
    noteSaveError,
    avatarUrl,
    setAvatarUrl,
    applySavedAdministrative,
    applySavedPedagogical,
    removeTeacherRelation,
  }
}
