/**
 * Droits d'édition/suppression d'une entrée de cahier de texte — calculés côté
 * front pour l'**affichage** uniquement (le serveur reste seul juge, règle du
 * 2026-08-11 : « le front choisit ce qu'il montre, il ne décide jamais ce qui
 * est autorisé »).
 *
 * Refonte du 2026-08-20 (point 3) : une entrée **normale** ne peut plus être
 * éditée/supprimée que par son auteur formateur — RP a perdu ce droit. Le
 * mécanisme des pages **spéciales** RP est explicitement hors périmètre et
 * reste inchangé (auteur, ou RP ; TI en plus pour l'édition).
 */

import type { PedagogicalLogPage } from '../api/pedagogicalLog'

export interface LogEntryViewerContext {
  userId: string | undefined
  isFormateur: boolean
  isResponsablePedagogique: boolean
  isTechnicienInformatique: boolean
}

export function canEditLogEntry(entry: PedagogicalLogPage, viewer: LogEntryViewerContext): boolean {
  if (entry.isSpecialPage) {
    return (
      entry.authorId === viewer.userId ||
      viewer.isResponsablePedagogique ||
      viewer.isTechnicienInformatique
    )
  }
  return viewer.isFormateur && entry.authorId === viewer.userId
}

export function canDeleteLogEntry(entry: PedagogicalLogPage, viewer: LogEntryViewerContext): boolean {
  if (entry.isSpecialPage) {
    return entry.authorId === viewer.userId || viewer.isResponsablePedagogique
  }
  return viewer.isFormateur && entry.authorId === viewer.userId
}
