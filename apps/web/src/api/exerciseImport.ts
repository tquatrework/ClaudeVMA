/**
 * Module API — import d'Exercices depuis un tableur (content-catalog-service).
 *
 * Contrat posé par `docs/architecture.md` > « Import d'Exercice depuis un tableur
 * (CSV/Excel), et modèle de type identique pour l'import de Quizz » (arbitrage du
 * 2026-09-02), documenté dans `docs/routes.md` > content-catalog-service > « Import
 * d'exercices depuis un fichier tableur ». Même mécanisme que l'import de Quizz
 * (`api/quizImport.ts`).
 */

import apiClient from './client'
import type { ExerciseImportBlockResult, ExerciseImportConstraints } from '../types/exercise'

/**
 * GET /exercises/import/constraints — plafond de taille en vigueur pour un envoi.
 * À lire AVANT d'ouvrir le sélecteur de fichier, même discipline que
 * `GET /profiles/avatar/constraints` (jamais codée en dur côté front).
 */
export async function fetchExerciseImportConstraints(): Promise<ExerciseImportConstraints> {
  const { data } = await apiClient.get<ExerciseImportConstraints>('/exercises/import/constraints')
  return data
}

/**
 * POST /exercises/import — import de plusieurs Exercices depuis un fichier CSV/Excel.
 * Multipart, un seul fichier, champ `file` (même convention que les autres envois
 * de fichier du projet — avatar, pièces jointes du cahier de texte, images de
 * mémo, import de Quizz). Réservé aux mêmes créateurs que la création manuelle
 * (formateur, AP, RP).
 *
 * Réponse : un résultat par bloc d'Exercice détecté dans le fichier — un bloc en
 * erreur n'empêche jamais la création des autres blocs valides du même fichier,
 * jamais un état succès/échec global.
 */
export async function importExercises(file: File): Promise<ExerciseImportBlockResult[]> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await apiClient.post<ExerciseImportBlockResult[]>(
    '/exercises/import',
    formData,
    { headers: { 'Content-Type': undefined } },
  )
  return data
}

/**
 * GET /exercises/import/template — fichier CSV modèle directement importable.
 * Renvoyé en octets bruts (`responseType: 'blob'`), même patron que les autres
 * téléchargements du projet (`downloadArchiveDocument`, `fetchLogAttachmentBlob`).
 */
export async function fetchExerciseImportTemplate(): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/exercises/import/template', {
    responseType: 'blob',
  })
  return data
}
