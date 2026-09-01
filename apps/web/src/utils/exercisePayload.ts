/**
 * buildExerciseCreatePayload — traduit l'état d'édition de `ExerciseForm` en payload d'API
 * (`CreateExercisePayload`), ou lève une erreur avec un message français directement affichable.
 *
 * Extrait de `ExerciseForm.tsx` pour rester lisible et testable isolément — même découpage que
 * `quizPayload.ts`/`QuizForm.tsx`.
 */

import type {
  AuthorExerciseDetail,
  AuthorExercisePart,
  CreateExercisePayload,
  PublicContentItem,
  PublicExerciseDetail,
} from '../types/exercise'
import {
  createEditableExercisePart,
  type EditableExercisePart,
} from '../components/content-catalog/ExercisePartEditor'
import { createEditableExerciseItem, type EditableExerciseItem } from '../components/content-catalog/ExerciseItemListEditor'

/**
 * `description` a été retirée le 2026-09-01 (arbitrage « Titre des Exercices et des Quizz »,
 * point 4) : libère de l'espace à l'écran, demande explicite de l'utilisateur. Un exercice déjà
 * enregistré avec une description ne l'affiche simplement plus — elle n'est jamais relue ici.
 */
export interface EditableExerciseFormState {
  title: string
  level: string
  difficulty: string
  theme: string
  competenciesInput: string
  tagsInput: string
  parts: EditableExercisePart[]
}

function splitCommaList(input: string): string[] {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

function buildItemsPayload(items: EditableExerciseItem[]) {
  return items
    .filter((item) => item.content.trim().length > 0)
    .map((item) => ({ type: item.type, content: item.content.trim() }))
}

export function buildExerciseCreatePayload(state: EditableExerciseFormState): CreateExercisePayload {
  if (!state.title.trim()) {
    throw new Error('Le titre est obligatoire.')
  }
  if (state.parts.length === 0) {
    throw new Error('Ajoutez au moins un bloc (énoncé ou question).')
  }

  const parts = state.parts.map((part, index) => {
    const items = buildItemsPayload(part.items)
    if (items.length === 0) {
      throw new Error(`Le bloc ${index + 1} doit contenir au moins un élément.`)
    }

    if (part.category === 'question') {
      const solutionItems = buildItemsPayload(part.solutionItems)
      if (solutionItems.length === 0) {
        throw new Error(`La solution du bloc ${index + 1} (question) est obligatoire.`)
      }
      return { category: 'question' as const, items, solution: { items: solutionItems } }
    }

    return { category: 'statement' as const, items }
  })

  const competencies = splitCommaList(state.competenciesInput)
  const tags = splitCommaList(state.tagsInput)

  return {
    title: state.title.trim(),
    ...(state.level.trim() ? { level: state.level.trim() } : {}),
    ...(state.difficulty.trim() ? { difficulty: state.difficulty.trim() } : {}),
    ...(state.theme.trim() ? { theme: state.theme.trim() } : {}),
    ...(competencies.length > 0 ? { competencies } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    parts,
  }
}

/** Convertit une liste d'items serveur (texte/formule/image) en items éditables — les items
 * `image` sont **omis**, ce formulaire JSON ne sait jamais en porter (`docs/routes.md` >
 * content-catalog-service > « Exercices — refonte du 2026-08-29 »).
 */
function buildEditableItemsFromContent(items: PublicContentItem[]): EditableExerciseItem[] {
  return items
    .filter((item): item is typeof item & { type: 'text' | 'formula' } =>
      item.type === 'text' || item.type === 'formula',
    )
    .map((item) => {
      const editableItem = createEditableExerciseItem(item.type)
      editableItem.content = item.content ?? ''
      return editableItem
    })
}

/**
 * Construit l'état d'édition initial à partir d'un exercice déjà enregistré.
 *
 * Accepte soit `GET /exercises/:id` (`PublicExerciseDetail`, jamais de solution), soit
 * `GET /exercises/:id/solutions` (`AuthorExerciseDetail`, réservée à l'auteur et aux AP/RP/TI,
 * corrective du 2026-09-01 — voir `fetchExerciseForEdit` dans `api/exercises.ts`). Quand la
 * solution d'un bloc question est disponible, elle est réellement pré-remplie (items
 * texte/formule uniquement — les images de solution ne sont, comme les images de bloc, jamais
 * reprises ici) ; sinon un seul élément vide est proposé, à ressaisir par l'auteur — signalé
 * explicitement à l'écran (`ExerciseEditPage`), jamais silencieusement vidé.
 */
export function buildEditableStateForExerciseEdit(
  exercise: PublicExerciseDetail | AuthorExerciseDetail,
): EditableExerciseFormState {
  const parts: EditableExercisePart[] = exercise.parts.map((part) => {
    const editablePart = createEditableExercisePart(part.category)
    const textOrFormulaItems = buildEditableItemsFromContent(part.items)

    const authorPart = part as AuthorExercisePart
    const prefilledSolutionItems =
      part.category === 'question' && authorPart.solution
        ? buildEditableItemsFromContent(authorPart.solution.items)
        : []

    return {
      ...editablePart,
      items: textOrFormulaItems.length > 0 ? textOrFormulaItems : editablePart.items,
      solutionItems:
        part.category === 'question'
          ? prefilledSolutionItems.length > 0
            ? prefilledSolutionItems
            : editablePart.solutionItems
          : [],
    }
  })

  return {
    title: exercise.title ?? '',
    level: exercise.level ?? '',
    difficulty: exercise.difficulty ?? '',
    theme: exercise.theme ?? '',
    competenciesInput: (exercise.competencies ?? []).join(', '),
    tagsInput: exercise.tags.join(', '),
    parts: parts.length > 0 ? parts : [createEditableExercisePart()],
  }
}
