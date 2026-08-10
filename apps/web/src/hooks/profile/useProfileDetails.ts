import { useCallback, useEffect, useMemo, useState } from 'react'
import { createInternalNote, fetchInternalNotes, fetchProfile } from '../../api/profile'
import { fetchTeacherStudentRelations } from '../../api/relations'
import type { InternalNote, Profile, TeacherStudentRelation } from '../../types/profile'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

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
   * Relit `GET /profiles/:userId`. À appeler après une écriture qui passe par
   * une **autre** route que celles de la fiche — la photo aujourd'hui — pour que
   * l'écran ne conserve pas une copie que le serveur contredit. Les données
   * déjà affichées restent en place pendant la relecture : rien ne clignote, et
   * la saisie en cours n'est pas perdue.
   */
  refreshProfile: () => void
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
  const { data, isLoading, error: loadError, refetch } = useAsyncData(
    () => loadProfileDetails(userId, canSeeRelations, canSeeInternalNotes),
    [userId, canSeeRelations, canSeeInternalNotes],
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

  /**
   * Les notes ajoutées localement sont oubliées avant la relecture : elles vont
   * revenir du serveur, les garder les afficherait en double.
   */
  const refreshProfile = useCallback(() => {
    setAddedNotes([])
    refetch()
  }, [refetch])

  return {
    profile: data?.profile ?? null,
    teacherRelations: data?.teacherRelations ?? [],
    internalNotes,
    isLoading,
    loadError,
    addNote,
    isSavingNote,
    noteSaveError,
    refreshProfile,
  }
}
