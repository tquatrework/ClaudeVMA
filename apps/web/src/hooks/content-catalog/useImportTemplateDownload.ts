/**
 * useImportTemplateDownload — télécharge le fichier modèle d'un import (Quizz ou
 * Exercice) et déclenche l'enregistrement local, avec un état de chargement et
 * d'erreur exploitable par l'écran. Factorisé une fois le même besoin identifié
 * sur les deux écrans d'import (`docs/architecture.md` > « Import d'Exercice
 * depuis un tableur (CSV/Excel), et modèle de type identique pour l'import de
 * Quizz », point 7).
 *
 * Le nom de fichier local reprend celui annoncé par le serveur
 * (`Content-Disposition`, voir `docs/routes.md`) — fixé ici plutôt que lu depuis
 * l'en-tête de réponse, `apiClient` ne remontant que le corps de la réponse aux
 * appelants de ce hook.
 */

import { useCallback, useState } from 'react'
import { triggerBlobDownload } from '../../utils/fileDownload'
import { getErrorMessage } from '../../utils/apiError'

const DOWNLOAD_ERROR_FALLBACK_MESSAGE =
  "Le fichier modèle n'a pas pu être téléchargé. Réessayez dans quelques instants."

export interface UseImportTemplateDownloadResult {
  downloadTemplate: () => Promise<void>
  isDownloadingTemplate: boolean
  downloadError: string | null
}

export function useImportTemplateDownload(
  fetchTemplate: () => Promise<Blob>,
  filename: string,
): UseImportTemplateDownloadResult {
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const downloadTemplate = useCallback(async () => {
    setIsDownloadingTemplate(true)
    setDownloadError(null)
    try {
      const blob = await fetchTemplate()
      triggerBlobDownload(blob, filename)
    } catch (caughtError) {
      setDownloadError(getErrorMessage(caughtError, DOWNLOAD_ERROR_FALLBACK_MESSAGE))
    } finally {
      setIsDownloadingTemplate(false)
    }
  }, [fetchTemplate, filename])

  return { downloadTemplate, isDownloadingTemplate, downloadError }
}
