/**
 * buildExerciseCreatePayload — traduit l'état d'édition de `ExerciseForm` en payload d'API
 * (`CreateExercisePayload`), ou lève une erreur avec un message français directement affichable.
 *
 * Extrait de `ExerciseForm.tsx` pour rester lisible et testable isolément — même découpage que
 * `quizPayload.ts`/`QuizForm.tsx`.
 */

import type { CreateExercisePayload, PublicExerciseDetail } from '../types/exercise'
import {
  createEditableExercisePart,
  type EditableExercisePart,
} from '../components/content-catalog/ExercisePartEditor'
import { createEditableExerciseItem, type EditableExerciseItem } from '../components/content-catalog/ExerciseItemListEditor'

export interface EditableExerciseFormState {
  title: string
  description: string
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
    ...(state.title.trim() ? { title: state.title.trim() } : {}),
    ...(state.description.trim() ? { description: state.description.trim() } : {}),
    ...(state.level.trim() ? { level: state.level.trim() } : {}),
    ...(state.difficulty.trim() ? { difficulty: state.difficulty.trim() } : {}),
    ...(state.theme.trim() ? { theme: state.theme.trim() } : {}),
    ...(competencies.length > 0 ? { competencies } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    parts,
  }
}

/**
 * Construit l'état d'édition initial à partir d'un exercice déjà enregistré
 * (`GET /exercises/:id`). Les items `text`/`formula` sont repris tels quels ; les items `image`
 * sont **omis** — `content-catalog-service` ne renvoie jamais le contenu d'une solution (aucune
 * route publique équivalente à `GET /quizzes/:id/solution` pour l'Exercice), et `PUT /exercises/:id`
 * supprime de toute façon les images déjà envoyées. L'auteur doit donc ressaisir sa solution à
 * chaque édition — signalé explicitement à l'écran (`ExerciseEditPage`), pas silencieusement vidé.
 */
export function buildEditableStateForExerciseEdit(
  exercise: PublicExerciseDetail,
): EditableExerciseFormState {
  const parts: EditableExercisePart[] = exercise.parts.map((part) => {
    const editablePart = createEditableExercisePart(part.category)
    const textOrFormulaItems = part.items
      .filter((item): item is typeof item & { type: 'text' | 'formula' } =>
        item.type === 'text' || item.type === 'formula',
      )
      .map((item) => {
        const editableItem = createEditableExerciseItem(item.type)
        editableItem.content = item.content ?? ''
        return editableItem
      })

    return {
      ...editablePart,
      items: textOrFormulaItems.length > 0 ? textOrFormulaItems : editablePart.items,
      // La solution n'est jamais relue : un seul élément vide, à ressaisir par l'auteur.
      solutionItems: part.category === 'question' ? editablePart.solutionItems : [],
    }
  })

  return {
    title: exercise.title ?? '',
    description: exercise.description ?? '',
    level: exercise.level ?? '',
    difficulty: exercise.difficulty ?? '',
    theme: exercise.theme ?? '',
    competenciesInput: (exercise.competencies ?? []).join(', '),
    tagsInput: exercise.tags.join(', '),
    parts: parts.length > 0 ? parts : [createEditableExercisePart()],
  }
}
