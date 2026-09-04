/**
 * useForumCharter — texte courant de la charte de bonne conduite (`GET /forums/charter`), avec
 * mise à jour optionnelle (`PATCH /forums/charter`, réservée au RP et au TI côté serveur).
 *
 * Chargé à la demande (ouverture de la lecture de la charte, ou du panneau d'édition RP/TI), pas
 * au montage global de l'application — la charte n'est nécessaire qu'à ces deux moments précis.
 */

import { useEffect, useState } from 'react'
import { fetchForumCharter, updateForumCharter } from '../../api/forums'
import { getErrorMessage } from '../../utils/apiError'

export interface UseForumCharterResult {
  content: string
  updatedAt: string | null
  isLoadingCharter: boolean
  loadError: string | null
  isSavingCharter: boolean
  saveError: string | null
  saveCharter: (nextContent: string) => Promise<boolean>
}

export function useForumCharter(shouldLoad: boolean): UseForumCharterResult {
  const [content, setContent] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [isLoadingCharter, setIsLoadingCharter] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [isSavingCharter, setIsSavingCharter] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!shouldLoad) return

    let isCancelled = false
    setIsLoadingCharter(true)
    setLoadError(null)

    fetchForumCharter()
      .then((charter) => {
        if (isCancelled) return
        setContent(charter.content)
        setUpdatedAt(charter.updatedAt)
      })
      .catch((caughtError: unknown) => {
        if (isCancelled) return
        setLoadError(getErrorMessage(caughtError, 'Impossible de lire la charte de bonne conduite.'))
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingCharter(false)
      })

    return () => {
      isCancelled = true
    }
  }, [shouldLoad])

  const saveCharter = async (nextContent: string): Promise<boolean> => {
    setIsSavingCharter(true)
    setSaveError(null)

    try {
      const charter = await updateForumCharter(nextContent)
      setContent(charter.content)
      setUpdatedAt(charter.updatedAt)
      return true
    } catch (caughtError: unknown) {
      setSaveError(getErrorMessage(caughtError, "Impossible d'enregistrer la charte."))
      return false
    } finally {
      setIsSavingCharter(false)
    }
  }

  return {
    content,
    updatedAt,
    isLoadingCharter,
    loadError,
    isSavingCharter,
    saveError,
    saveCharter,
  }
}
