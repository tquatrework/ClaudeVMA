/**
 * Déclenche le téléchargement d'un `Blob` déjà récupéré (route authentifiée lue via
 * `apiClient`), sous le nom de fichier fourni — même mécanisme que celui déjà répété
 * dans plusieurs écrans du projet (`useLogEntryAttachments`, `PedagogicalArchivePage`,
 * `LegalDocumentsPage`) : un `<a>` temporaire pointant vers un object URL, jamais un
 * lien direct vers l'API (qui n'enverrait pas le jeton d'authentification).
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}
