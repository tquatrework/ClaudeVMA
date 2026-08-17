/**
 * useReadOnlyAvatar — photo d'une personne liée, en lecture seule, quand on ne
 * connaît pas encore son `avatarUrl` versionné (celui du bloc `administrative` de
 * `GET /profiles/:userId`).
 *
 * Cas d'usage : la tuile « Mon professeur » du dashboard élève affiche la photo du
 * professeur assigné, résolu via la relation élève↔formateur
 * (`useAssignedTeacher`), qui ne porte que `teacherId`/`teacherName` — jamais
 * `avatarUrl`. Aller chercher ce champ obligerait à appeler `GET /profiles/:teacherId`,
 * route qui reste aujourd'hui fermée à un élève consultant le profil de son
 * formateur (`docs/architecture.md` > « Décisions en attente de l'utilisateur »,
 * point 3, non résolu à ce jour).
 *
 * Ce hook contourne ce point ouvert sans y toucher : il appelle directement
 * `GET /profiles/:userId/avatar` (sans jeton de version, puisqu'il n'y en a pas de
 * connu) et dégrade silencieusement vers l'absence de photo pour **toute** erreur —
 * pas de photo, photo masquée, ou droit de lecture refusé sur le profil. La tuile
 * retombe alors sur l'avatar de repli (initiales), exactement comme pour un
 * professeur qui n'a simplement pas encore ajouté de photo.
 */

import { useEffect, useState } from 'react'
import { fetchProfileAvatarBlob } from '../../api/profile'
import { getErrorStatus } from '../../utils/apiError'

export interface UseReadOnlyAvatarResult {
  photoObjectUrl: string | null
  isLoadingPhoto: boolean
}

export function useReadOnlyAvatar(userId: string | undefined): UseReadOnlyAvatarResult {
  const [photoObjectUrl, setPhotoObjectUrl] = useState<string | null>(null)
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false)

  useEffect(() => {
    if (!userId) {
      setPhotoObjectUrl(null)
      setIsLoadingPhoto(false)
      return
    }

    let isCancelled = false
    let createdObjectUrl: string | null = null

    setPhotoObjectUrl(null)
    setIsLoadingPhoto(true)

    const loadPhoto = async () => {
      try {
        const photoBlob = await fetchProfileAvatarBlob(userId)
        if (isCancelled) return
        createdObjectUrl = URL.createObjectURL(photoBlob)
        setPhotoObjectUrl(createdObjectUrl)
      } catch (caughtError) {
        if (isCancelled) return
        const status = getErrorStatus(caughtError)
        // 404 : pas de photo, ou masquée. 403 : droit de lecture refusé sur le
        // profil (écart connu pour un élève consultant son formateur, voir
        // ci-dessus). Les deux dégradent silencieusement vers l'avatar de repli ;
        // seul un échec inattendu (réseau, 5xx) est journalisé pour diagnostic.
        if (status !== 404 && status !== 403) {
          console.warn('[avatar] lecture impossible pour un tiers :', caughtError)
        }
      } finally {
        if (!isCancelled) setIsLoadingPhoto(false)
      }
    }

    void loadPhoto()

    return () => {
      isCancelled = true
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl)
    }
  }, [userId])

  return { photoObjectUrl, isLoadingPhoto }
}
