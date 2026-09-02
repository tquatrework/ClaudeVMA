/**
 * Module API — import de Quizz depuis un tableur (content-catalog-service).
 *
 * Contrat posé par `docs/architecture.md` > « Import de Quizz depuis un tableur »
 * (arbitrage du 2026-08-29, PR #175 « docs » — pas encore mergée dans `master` au
 * moment de l'écriture de ce front). `content-catalog-service` développe la route
 * réelle EN PARALLÈLE sur ce même contrat : noms de champs à réconcilier avec la
 * PR `content-catalog-service` une fois ouverte, si un écart apparaît — voir le
 * commentaire de tête de `src/types/quiz.ts` et le rapport de session.
 */

import apiClient from './client'
import type { QuizImportBlockResult, QuizImportConstraints } from '../types/quiz'

/**
 * GET /quizzes/import/constraints — plafond de taille en vigueur pour un envoi.
 * À lire AVANT d'ouvrir le sélecteur de fichier, même discipline que
 * `GET /profiles/avatar/constraints` (jamais codée en dur côté front).
 */
export async function fetchQuizImportConstraints(): Promise<QuizImportConstraints> {
  const { data } = await apiClient.get<QuizImportConstraints>('/quizzes/import/constraints')
  return data
}

/**
 * POST /quizzes/import — import de plusieurs Quizz depuis un fichier CSV/Excel.
 * Multipart, un seul fichier, champ `file` (même convention que les autres envois
 * de fichier du projet — avatar, pièces jointes du cahier de texte, images de
 * mémo). Réservé aux mêmes créateurs que la création manuelle (formateur, AP, RP).
 *
 * Réponse : un résultat par bloc de Quizz détecté dans le fichier — un bloc en
 * erreur n'empêche jamais la création des autres blocs valides du même fichier,
 * jamais un état succès/échec global.
 */
export async function importQuizzes(file: File): Promise<QuizImportBlockResult[]> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await apiClient.post<QuizImportBlockResult[]>('/quizzes/import', formData, {
    headers: { 'Content-Type': undefined },
  })
  return data
}

/**
 * GET /quizzes/import/template — fichier CSV modèle directement importable.
 * Ajoutée rétroactivement le 2026-09-02 (`docs/architecture.md` > « Import d'Exercice
 * depuis un tableur… », point 7) : l'import de Quizz n'avait jamais eu de fichier
 * modèle depuis sa création. Renvoyé en octets bruts (`responseType: 'blob'`), même
 * patron que les autres téléchargements du projet.
 */
export async function fetchQuizImportTemplate(): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/quizzes/import/template', {
    responseType: 'blob',
  })
  return data
}
