/**
 * Point unique de correspondance `itemType` technique → libellé français et couleur.
 *
 * Ces tables vivaient en double dans `ArchiveTimeline` et `ArchiveItemDetail`, avec
 * cinq valeurs qui n'existent pas côté serveur : un même champ y portait deux
 * libellés selon l'écran, et aucun des deux ne correspondait à la réalité.
 * Règle de langue du 2026-08-09 : noms techniques en anglais, libellés en français,
 * correspondance en un seul endroit.
 */

import type { ArchiveItemType } from '../api/archiveDocument'

export const ARCHIVE_ITEM_TYPE_LABELS: Record<ArchiveItemType, string> = {
  cahier_de_texte: 'Cahier de texte',
  carnet_personnel: 'Carnet personnel',
  resume_de_cours: 'Résumé de cours',
  contenu_eleve: 'Contenu pédagogique',
  parcours: 'Parcours',
  exercice_evaluation: 'Exercice / évaluation',
  video: 'Enregistrement vidéo',
}

export const ARCHIVE_ITEM_TYPE_COLORS: Record<ArchiveItemType, string> = {
  cahier_de_texte: 'bg-blue-100 text-blue-700',
  carnet_personnel: 'bg-purple-100 text-purple-700',
  resume_de_cours: 'bg-green-100 text-green-700',
  contenu_eleve: 'bg-gray-100 text-gray-700',
  parcours: 'bg-amber-100 text-amber-700',
  exercice_evaluation: 'bg-cyan-100 text-cyan-700',
  video: 'bg-orange-100 text-orange-700',
}

export function getArchiveItemTypeLabel(itemType: ArchiveItemType | string): string {
  return ARCHIVE_ITEM_TYPE_LABELS[itemType as ArchiveItemType] ?? itemType
}

export function getArchiveItemTypeColor(itemType: ArchiveItemType | string): string {
  return ARCHIVE_ITEM_TYPE_COLORS[itemType as ArchiveItemType] ?? 'bg-gray-100 text-gray-700'
}
