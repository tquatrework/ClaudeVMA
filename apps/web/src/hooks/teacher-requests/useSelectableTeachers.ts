/**
 * useSelectableTeachers — annuaire des formateurs que le RP peut solliciter (étape 3).
 *
 * Source : `GET /profiles/teachers/validated` (profile-service, livrée le 2026-08-12),
 * réservée aux administrateurs — RP, AF et TI. Tout autre rôle reçoit `403`,
 * **l'animateur pédagogique compris** : le hook n'appelle donc rien tant que
 * l'appelant n'y a pas droit, une entrée qui mène à un refus ne devant même pas
 * être tentée.
 *
 * Deux pièges du contrat, tenus ici :
 * 1. la réponse est une **enveloppe** `{data, page, limit, total, totalPages}` —
 *    lire la racine comme un tableau ne renverrait jamais aucun formateur ;
 * 2. la liste est **bornée à 100 par page**. Deux formateurs aujourd'hui, mais on
 *    ne code pas comme si la première page suffisait toujours : les pages suivantes
 *    sont enchaînées jusqu'à `totalPages`.
 */

import { fetchValidatedTeachers, VALIDATED_TEACHERS_MAX_LIMIT } from '../../api/profile'
import type { ValidatedTeacher } from '../../types/profile'
import type { SelectableTeacher } from '../../types/teacherRequests'
import { toSelectableTeacher } from '../../utils/teacherDirectory'
import { useAsyncData } from '../useAsyncData'

export type { SelectableTeacher }

/**
 * Garde-fou : au-delà, on cesse de paginer et on le **dit** (`isTruncated`).
 * 20 pages × 100 = 2 000 formateurs. Un plafond non déclaré serait un plafond
 * caché ; une boucle non bornée serait pire — un `totalPages` aberrant
 * enfermerait l'écran dans une suite de requêtes sans fin.
 */
export const MAX_DIRECTORY_PAGES = 20

export interface ValidatedTeacherDirectory {
  teachers: SelectableTeacher[]
  /** `true` si le garde-fou de pagination a coupé avant la dernière page. */
  isTruncated: boolean
}

/** Ne se résout jamais : l'appel n'a pas lieu d'être, et rien ne doit s'afficher. */
function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

async function loadDirectory(isEnabled: boolean): Promise<ValidatedTeacherDirectory> {
  if (!isEnabled) return pendingForever<ValidatedTeacherDirectory>()

  const collectedTeachers: ValidatedTeacher[] = []
  let currentPage = 1
  let totalPages = 1

  while (currentPage <= totalPages && currentPage <= MAX_DIRECTORY_PAGES) {
    const response = await fetchValidatedTeachers(currentPage, VALIDATED_TEACHERS_MAX_LIMIT)
    collectedTeachers.push(...response.data)
    totalPages = Number.isFinite(response.totalPages) ? response.totalPages : currentPage
    currentPage += 1
  }

  return {
    teachers: collectedTeachers.map(toSelectableTeacher),
    isTruncated: totalPages > MAX_DIRECTORY_PAGES,
  }
}

export interface UseSelectableTeachersResult {
  teachers: SelectableTeacher[]
  isLoading: boolean
  /** Message français prêt à afficher, `null` quand le chargement s'est bien passé. */
  loadError: string | null
  isTruncated: boolean
}

/**
 * @param isEnabled `true` seulement pour les rôles autorisés par la route
 *   (aujourd'hui le RP sur cet écran). À `false`, aucun appel n'est émis et
 *   l'état reste en chargement, ce qui n'est jamais observé : le composeur
 *   lui-même n'est pas affiché.
 */
export function useSelectableTeachers(isEnabled: boolean): UseSelectableTeachersResult {
  const { data, isLoading, error } = useAsyncData(() => loadDirectory(isEnabled), [isEnabled], {
    fallbackErrorMessage: "Impossible de charger la liste des professeurs.",
  })

  return {
    teachers: data?.teachers ?? [],
    isLoading,
    loadError: error,
    isTruncated: data?.isTruncated ?? false,
  }
}
