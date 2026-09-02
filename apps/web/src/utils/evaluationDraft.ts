/**
 * evaluationDraft — préservation du brouillon de création d'Évaluation pendant l'aller-retour vers
 * la création d'un Exercice (bouton « Nouveau » de `EvaluationExercisePicker`).
 *
 * Demande explicite de l'utilisateur (2026-09-02) : depuis le formulaire de création d'une
 * Évaluation, un bouton « Nouveau » à côté de « Rechercher » doit permettre de créer un Exercice
 * sans perdre ce qui est déjà saisi (titre, métadonnées, autres exercices déjà choisis), puis
 * revenir sur la création de l'Évaluation en cours — pas sur le catalogue d'Exercices — avec le
 * nouvel Exercice ajouté à la suite ordonnée.
 *
 * `sessionStorage` plutôt qu'un état de navigation React Router pur : le trajet traverse une page
 * intermédiaire (`ExerciseCatalogPage`) qui n'a pas à connaître le détail du formulaire Évaluation
 * pour le relayer — elle ne relaie qu'un signal léger de navigation (voir
 * `EvaluationExercisePickerNavigationState`/`EvaluationDraftResumeState` ci-dessous) et laisse
 * `sessionStorage` porter la charge utile réelle, relue une seule fois au retour puis effacée
 * immédiatement (`loadAndClearEvaluationDraftForExerciseCreation`).
 *
 * **Même mécanisme pour « Nouveau » et « Rechercher » (2026-09-02, second retour utilisateur)** :
 * le bouton « Rechercher » ouvrait jusqu'ici une recherche strictement locale à
 * `EvaluationExercisePicker`, cassée par un bug réel (formulaire `<form>` imbriqué dans le
 * `<form>` d'`EvaluationForm` — invalide en HTML, le navigateur ignore le tag `<form>` interne et
 * son bouton « submit » soumet alors le formulaire ENGLOBANT au lieu de lancer la recherche,
 * d'où « le bouton ne fait rien » de perceptible). Corrigé en supprimant purement et simplement la
 * recherche locale : « Rechercher » navigue désormais vers le catalogue d'Exercices réel
 * (`ExerciseCatalogPage`), pré-filtré par le mot-clé tapé, exactement comme « Nouveau » navigue
 * vers ce même catalogue pour y créer un Exercice — seul `exercisePickerIntent` distingue les deux
 * intentions au retour.
 */

import type { EditableEvaluationExerciseItem } from '../components/content-catalog/EvaluationExercisePicker'
import { createEmptyScoringState, type EditableEvaluationScoringState } from './evaluationScoring'

export interface EditableEvaluationFormState {
  title: string
  level: string
  difficulty: string
  theme: string
  competenciesInput: string
  tagsInput: string
  durationMinutes: string
  blockBackNavigation: boolean
  exerciseItems: EditableEvaluationExerciseItem[]
  /** Barème informatif (arbitrage du 2026-09-02) — absent sur un brouillon antérieur à ce
   * chantier relu depuis `sessionStorage` ; `EvaluationForm` retombe alors sur un état vide. */
  scoring?: EditableEvaluationScoringState
}

export { createEmptyScoringState }

/**
 * État de navigation transmis à `/content/exercises` (Évaluation → Exercices), léger — la charge
 * utile réelle (le brouillon) transite par `sessionStorage`, voir ci-dessus.
 * - `intent: 'create'` (bouton « Nouveau ») : `ExerciseCatalogPage` ouvre directement le
 *   formulaire de création ; à la création réussie, retour automatique vers l'Évaluation avec le
 *   nouvel Exercice ajouté.
 * - `intent: 'search'` (bouton « Rechercher ») : `ExerciseCatalogPage` pré-filtre le catalogue
 *   avec `prefillKeyword` ; choisir un Exercice dans la liste ramène vers l'Évaluation avec cet
 *   Exercice ajouté, **sans jamais aller sur sa fiche de détail** (comportement normal court-
 *   circuité tant que ce mode est actif).
 */
export interface EvaluationExercisePickerNavigationState {
  returnToEvaluationDraft: true
  exercisePickerIntent: 'create' | 'search'
  prefillKeyword?: string
}

/** État de navigation transmis à `/content/evaluations` au retour (Exercices → Évaluation). */
export interface EvaluationDraftResumeState {
  resumeEvaluationDraft: true
  /** Absent si l'utilisateur revient sans avoir choisi/créé d'Exercice (ex. lien « Retour »). */
  newExercise?: { id: string; title: string }
}

const SESSION_KEY = 'evaluationDraftBeforeExerciseCreation'

/** Sauvegarde le brouillon avant de quitter la page pour créer un Exercice. */
export function saveEvaluationDraftForExerciseCreation(draft: EditableEvaluationFormState): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(draft))
  } catch {
    // sessionStorage indisponible (navigation privée stricte, quota atteint…) : le retour se fera
    // simplement sans brouillon restauré — pas d'erreur bloquante pour autant, la création
    // d'Exercice elle-même n'en dépend pas.
  }
}

/** Relit le brouillon une seule fois (le retire de `sessionStorage` dans le même geste), ou `null`
 * si aucun brouillon n'est en attente ou si sa forme est invalide. */
export function loadAndClearEvaluationDraftForExerciseCreation(): EditableEvaluationFormState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as EditableEvaluationFormState
    if (typeof parsed?.title !== 'string' || !Array.isArray(parsed?.exerciseItems)) return null
    return parsed
  } catch {
    return null
  }
}
