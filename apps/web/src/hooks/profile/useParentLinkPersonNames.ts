/**
 * useParentLinkPersonNames — résout en prénom + nom les personnes citées par une
 * demande de rattachement parent ↔ élève.
 *
 * Pourquoi un hook dédié plutôt que `usePersonDisplayName` : ce dernier appelle
 * `GET /profiles/:userId` **par personne**, alors qu'une demande de rattachement
 * précède le lien qui ouvre justement ce droit de lecture. Relevé sur la pile
 * réelle le 2026-08-11 (profile-service, comptes de test créés pour l'occasion) :
 *
 *   | Lecteur → cible                       | demande `pending` | après acceptation |
 *   |---------------------------------------|-------------------|-------------------|
 *   | parent → `GET /profiles/<élève>`      | 403               | 200               |
 *   | élève  → `GET /profiles/<parent>`     | 403               | 403               |
 *
 * Un élève ne peut lire que son propre profil (« An élève may only view their own
 * profile »), y compris après rattachement. Enchaîner des `GET /profiles/:id`
 * voués au 403 serait du bruit réseau pour retomber, au mieux, sur un libellé
 * générique.
 *
 * Deux sources sont donc utilisées, aucune ne provoquant de 403 attendu :
 *  1. les routes de relations, qui portent **déjà** le nom résolu côté serveur
 *     (`studentName` / `financeOwnerName`) — un seul appel, pas de N+1 ;
 *  2. `GET /profiles/:userId`, réservé aux rôles qui ont le droit de lire
 *     n'importe quel profil (RP, TI), et seulement pour les personnes que les
 *     relations n'ont pas nommées.
 *
 * Ce que le hook ne fait jamais : renvoyer un identifiant technique. Une personne
 * non résolue vaut `null`, et l'appelant affiche un libellé français explicite
 * (`formatCounterpartLabel`).
 */

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../useAuth'
import { fetchLinkedParents, fetchLinkedStudents, fetchStudentProfile } from '../../api/relations'
import type { PersonName } from '../../types/profile'

export interface UseParentLinkPersonNamesResult {
  /** Prénom + nom de la personne, ou `null` si le lecteur n'y a pas accès. */
  getPersonName: (userId: string | null | undefined) => PersonName | null
  isLoading: boolean
}

export function useParentLinkPersonNames(personIds: string[]): UseParentLinkPersonNamesResult {
  const { user } = useAuth()
  const [personNamesByUserId, setPersonNamesByUserId] = useState<Record<string, PersonName>>({})
  const [isLoading, setIsLoading] = useState(false)

  const viewerId = user?.id
  const viewerRole = user?.role
  // Clé stable : `personIds` est un tableau reconstruit à chaque rendu.
  const personIdsKey = personIds.join(',')

  useEffect(() => {
    const requestedIds = personIdsKey ? personIdsKey.split(',') : []
    if (!viewerId || requestedIds.length === 0) {
      setIsLoading(false)
      return
    }

    let isCurrentRequest = true
    setIsLoading(true)

    const collectFromRelations = async (): Promise<Record<string, PersonName>> => {
      const resolvedNames: Record<string, PersonName> = {}
      if (viewerRole === 'parent_financeur') {
        const links = await fetchLinkedStudents(viewerId)
        links.forEach((link) => {
          if (link.studentName) resolvedNames[link.studentId] = link.studentName
        })
      } else if (viewerRole === 'eleve') {
        const links = await fetchLinkedParents(viewerId)
        links.forEach((link) => {
          if (link.financeOwnerName) resolvedNames[link.financeOwnerId] = link.financeOwnerName
        })
      }
      return resolvedNames
    }

    const collectFromProfiles = async (
      unresolvedIds: string[],
    ): Promise<Record<string, PersonName>> => {
      const canReadAnyProfile =
        viewerRole === 'responsable_pedagogique' || viewerRole === 'technicien_informatique'
      if (!canReadAnyProfile || unresolvedIds.length === 0) return {}

      const resolvedNames: Record<string, PersonName> = {}
      await Promise.allSettled(
        unresolvedIds.map(async (userId) => {
          const profile = await fetchStudentProfile(userId)
          const firstName = profile.administrative?.firstName ?? null
          const lastName = profile.administrative?.lastName ?? null
          if (firstName || lastName) resolvedNames[userId] = { firstName, lastName }
        }),
      )
      return resolvedNames
    }

    const resolveNames = async () => {
      let resolvedNames: Record<string, PersonName> = {}
      try {
        resolvedNames = await collectFromRelations()
      } catch {
        // Pas de nom depuis les relations : l'écran affichera un libellé explicite,
        // jamais un identifiant. Ce n'est pas une erreur à remonter à l'utilisateur.
        resolvedNames = {}
      }

      const unresolvedIds = requestedIds.filter((userId) => !resolvedNames[userId])
      const profileNames = await collectFromProfiles(unresolvedIds)

      if (!isCurrentRequest) return
      setPersonNamesByUserId({ ...resolvedNames, ...profileNames })
    }

    resolveNames().finally(() => {
      if (isCurrentRequest) setIsLoading(false)
    })

    return () => {
      isCurrentRequest = false
    }
  }, [viewerId, viewerRole, personIdsKey])

  const getPersonName = useCallback(
    (userId: string | null | undefined) => (userId ? personNamesByUserId[userId] ?? null : null),
    [personNamesByUserId],
  )

  return { getPersonName, isLoading }
}
