/**
 * useFinanceOwnerStudentLinks — la liste des liens de financement de l'utilisateur,
 * et la rupture d'un de ces liens (« Délier », 2026-08-11).
 *
 * Un seul hook pour les **deux sens** : l'élève qui liste ses parents financeurs et
 * le parent financeur qui liste ses élèves regardent la même table, depuis deux
 * côtés. Seule la route de lecture change ; la rupture, elle, est strictement la
 * même requête dans les deux cas — elle nomme la paire, pas un point de vue.
 *
 * Points de comportement portés ici, une fois pour les deux écrans :
 *
 * 1. **La liste se met à jour depuis la réponse du serveur**, sans nouvelle requête.
 *    La réponse du `DELETE` porte `endedAt` : le lien rompu quitte la liste des liens
 *    actifs. On réaffiche ce que le serveur a enregistré, jamais ce qu'on a envoyé
 *    (règle du 2026-08-10).
 * 2. **Le double clic ne produit pas d'erreur.** La rupture est idempotente côté
 *    serveur, mais un envoi en rafale reste inutile : une rupture déjà en vol bloque
 *    la suivante.
 * 3. **Aucun cache** (décision assumée du 2026-08-10) : la lecture a lieu au montage,
 *    et seulement là.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchLinkedParents,
  fetchLinkedStudents,
  unlinkFinanceOwnerAndStudent,
} from '../../api/relations'
import type { FinanceOwnerStudentLink } from '../../types/relations'
import { describeUnlinkFailure, type FinanceLinkViewerSide } from '../../utils/relationLabels'

interface UseFinanceOwnerStudentLinksOptions {
  /** Côté du lien où se trouve l'utilisateur connecté. */
  viewerSide: FinanceLinkViewerSide
  /** `userId` de l'utilisateur connecté — sert à l'appel, jamais à l'affichage. */
  viewerId: string
}

export interface UseFinanceOwnerStudentLinksResult {
  links: FinanceOwnerStudentLink[]
  isLoading: boolean
  loadError: string | null
  /** Rechargement explicite, après l'approbation d'une demande de rattachement. */
  reload: () => Promise<void>
  /** Lien dont la rupture attend confirmation, `null` si aucune boîte n'est ouverte. */
  pendingUnlink: FinanceOwnerStudentLink | null
  requestUnlink: (link: FinanceOwnerStudentLink) => void
  cancelUnlink: () => void
  confirmUnlink: () => Promise<void>
  isUnlinking: boolean
  unlinkError: string | null
}

const LOAD_ERROR_MESSAGES: Record<FinanceLinkViewerSide, string> = {
  student: 'Impossible de charger vos parents financeurs.',
  finance_owner: 'Impossible de charger vos élèves rattachés.',
}

/** Deux liens désignent la même relation quand ils nomment la même paire. */
function isSameLink(left: FinanceOwnerStudentLink, right: FinanceOwnerStudentLink): boolean {
  return left.financeOwnerId === right.financeOwnerId && left.studentId === right.studentId
}

export function useFinanceOwnerStudentLinks({
  viewerSide,
  viewerId,
}: UseFinanceOwnerStudentLinksOptions): UseFinanceOwnerStudentLinksResult {
  const [links, setLinks] = useState<FinanceOwnerStudentLink[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [pendingUnlink, setPendingUnlink] = useState<FinanceOwnerStudentLink | null>(null)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [unlinkError, setUnlinkError] = useState<string | null>(null)

  /**
   * Une rupture en vol interdit la suivante. La référence, et non l'état, parce
   * qu'un double clic rapide déclenche les deux appels avant le moindre rendu.
   */
  const isUnlinkInFlightRef = useRef(false)

  /**
   * Un seul appel : la route renvoie déjà le nom de l'autre partie, résolu côté
   * serveur. Surtout pas de ré-enrichissement par `GET /profiles/:id` — un élève
   * n'a pas le droit de lire le profil de son parent (403), ce qui faisait
   * autrefois retomber l'affichage sur l'UUID.
   */
  const reload = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const loadedLinks =
        viewerSide === 'student'
          ? await fetchLinkedParents(viewerId)
          : await fetchLinkedStudents(viewerId)
      setLinks(loadedLinks)
    } catch {
      setLoadError(LOAD_ERROR_MESSAGES[viewerSide])
    } finally {
      setIsLoading(false)
    }
  }, [viewerSide, viewerId])

  useEffect(() => {
    reload()
  }, [reload])

  const requestUnlink = useCallback((link: FinanceOwnerStudentLink) => {
    setUnlinkError(null)
    setPendingUnlink(link)
  }, [])

  const cancelUnlink = useCallback(() => {
    if (isUnlinkInFlightRef.current) return
    setUnlinkError(null)
    setPendingUnlink(null)
  }, [])

  const confirmUnlink = useCallback(async () => {
    if (!pendingUnlink || isUnlinkInFlightRef.current) return

    isUnlinkInFlightRef.current = true
    setIsUnlinking(true)
    setUnlinkError(null)

    try {
      const closedLink = await unlinkFinanceOwnerAndStudent(
        pendingUnlink.financeOwnerId,
        pendingUnlink.studentId,
      )
      // C'est la réponse du serveur qui fait foi : le lien qu'elle nomme quitte la
      // liste des liens actifs, sans qu'on aille redemander la liste entière.
      setLinks((currentLinks) => currentLinks.filter((link) => !isSameLink(link, closedLink)))
      setPendingUnlink(null)
    } catch (error) {
      // La boîte reste ouverte : l'utilisateur voit le refus au lieu de croire son
      // lien rompu.
      setUnlinkError(describeUnlinkFailure(error))
    } finally {
      isUnlinkInFlightRef.current = false
      setIsUnlinking(false)
    }
  }, [pendingUnlink])

  return {
    links,
    isLoading,
    loadError,
    reload,
    pendingUnlink,
    requestUnlink,
    cancelUnlink,
    confirmUnlink,
    isUnlinking,
    unlinkError,
  }
}
