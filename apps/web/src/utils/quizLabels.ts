/**
 * Point unique de correspondance statut/catégorie technique → libellé français, pour le Quizz.
 * Même modèle que `teacherRequestLabels.ts` / `archiveLabels.ts` (règle de langue du 2026-08-09).
 */

import type { QuizQuestionCategory, QuizStatus } from '../types/quiz'

export const QUIZ_STATUS_LABELS: Record<QuizStatus, string> = {
  pending_validation: 'En attente de validation',
  validated: 'Validé',
  rejected: 'Refusé',
}

export const QUIZ_STATUS_BADGE_CLASSES: Record<QuizStatus, string> = {
  pending_validation: 'bg-orange-100 text-orange-700',
  validated: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export const QUIZ_QUESTION_CATEGORY_LABELS: Record<QuizQuestionCategory, string> = {
  single_choice: 'Choix unique',
  multiple_choice: 'Choix multiples',
  short_text: 'Texte court',
}

/**
 * Normalise `score`/`maxScore`, renvoyés en nombre par `POST /quiz-attempts/:id/submit` mais en
 * chaîne décimale (`"6.00"`) par `GET /quiz-attempts/history` (sérialisation Postgres côté
 * serveur, vérifié contre la pile réelle le 2026-08-28). `null` reste `null` (tentative non
 * terminée) — ne jamais le confondre avec `0`.
 */
export function toQuizScore(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Formate un score pour l'affichage, sans jamais l'arrondir à zéro ni masquer un signe négatif
 * (une pénalité peut rendre le score d'une question — ou du quizz — négatif, arbitrage du
 * 2026-08-28). Les scores sont arrondis à 2 décimales seulement s'ils ne sont pas entiers, pour
 * éviter d'afficher "6.00" là où "6" suffit.
 */
export function formatQuizScore(value: number | string | null | undefined): string {
  const parsed = toQuizScore(value)
  if (parsed === null) return '—'
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2)
}
