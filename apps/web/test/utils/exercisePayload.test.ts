/**
 * Tests de `exercisePayload.ts` — couvre en priorité le correctif du 2026-09-01 (« en édition,
 * l'image de solution doit être modifiable ») : résolution d'une image de solution nouvellement
 * choisie ou déjà enregistrée, et prise en compte de cette image dans la validation de composition
 * minimale et dans le payload final.
 */

import { describe, it, expect } from 'vitest'
import {
  buildEditableStateForExerciseEdit,
  buildExerciseCreatePayload,
  ExerciseFormValidationError,
} from '../../src/utils/exercisePayload'
import { resolveExerciseSolutionImagePayloadItems } from '../../src/utils/exerciseImageResolution'
import {
  createEditableExercisePart,
  type EditableExercisePart,
} from '../../src/components/content-catalog/ExercisePartEditor'
import { createEditableExerciseItem } from '../../src/components/content-catalog/ExerciseItemListEditor'
import type { AuthorExerciseDetail, PublicExerciseDetail } from '../../src/types/exercise'

function statementPart(): EditableExercisePart {
  const part = createEditableExercisePart('statement')
  part.items = [{ ...createEditableExerciseItem('text'), content: 'Énoncé' }]
  return part
}

function questionPart(overrides: Partial<EditableExercisePart> = {}): EditableExercisePart {
  const part = createEditableExercisePart('question')
  part.items = [{ ...createEditableExerciseItem('text'), content: 'Question' }]
  part.solutionItems = [{ ...createEditableExerciseItem('text'), content: 'Solution texte' }]
  return { ...part, ...overrides }
}

const EMPTY_IMAGE_MAP = new Map()

describe('resolveExerciseSolutionImagePayloadItems', () => {
  it("résout un nouveau fichier choisi pour l'image de solution", async () => {
    const file = new File(['fake-bytes'], 'solution.png', { type: 'image/png' })
    const part = questionPart({ solutionImageFile: file })

    const resolved = await resolveExerciseSolutionImagePayloadItems([part])

    const item = resolved.get(part.localId)
    expect(item?.type).toBe('image')
    expect(item?.imageOriginalFilename).toBe('solution.png')
    expect(item?.imageData).toMatch(/^data:/)
  })

  it('réinjecte le base64 déjà en mémoire pour une image de solution déjà enregistrée, sans appel réseau', async () => {
    const part = questionPart({
      existingSolutionImageItem: {
        id: 'item-1',
        type: 'image',
        order: 1,
        content: 'légende',
        imageData: 'AAAA',
      },
    })

    const resolved = await resolveExerciseSolutionImagePayloadItems([part])

    expect(resolved.get(part.localId)).toEqual({
      type: 'image',
      imageData: 'AAAA',
      content: 'légende',
    })
  })

  it('ne résout rien pour un bloc question sans image de solution', async () => {
    const part = questionPart()
    const resolved = await resolveExerciseSolutionImagePayloadItems([part])
    expect(resolved.has(part.localId)).toBe(false)
  })

  it('ignore les blocs non-question', async () => {
    const part = statementPart()
    const resolved = await resolveExerciseSolutionImagePayloadItems([part])
    expect(resolved.size).toBe(0)
  })
})

describe('buildExerciseCreatePayload — solution avec image', () => {
  it("accepte une solution ne portant qu'une image (aucun texte)", () => {
    const question = questionPart({ solutionItems: [] })
    const solutionImages = new Map([
      [question.localId, { type: 'image' as const, imageData: 'AAAA', imageOriginalFilename: 'x.png' }],
    ])

    const payload = buildExerciseCreatePayload(
      {
        title: 'Titre',
        level: '',
        difficulty: '',
        theme: '',
        competenciesInput: '',
        tagsInput: '',
        parts: [statementPart(), question],
      },
      EMPTY_IMAGE_MAP,
      solutionImages,
    )

    const questionOut = payload.parts.find((p) => p.category === 'question')
    expect(questionOut?.solution?.items).toEqual([
      { type: 'image', imageData: 'AAAA', imageOriginalFilename: 'x.png' },
    ])
  })

  it('combine texte et image dans la même solution', () => {
    const question = questionPart()
    const solutionImages = new Map([
      [question.localId, { type: 'image' as const, imageData: 'AAAA' }],
    ])

    const payload = buildExerciseCreatePayload(
      {
        title: 'Titre',
        level: '',
        difficulty: '',
        theme: '',
        competenciesInput: '',
        tagsInput: '',
        parts: [statementPart(), question],
      },
      EMPTY_IMAGE_MAP,
      solutionImages,
    )

    const questionOut = payload.parts.find((p) => p.category === 'question')
    expect(questionOut?.solution?.items).toEqual([
      { type: 'text', content: 'Solution texte' },
      { type: 'image', imageData: 'AAAA' },
    ])
  })

  it('refuse une solution sans texte ni image', () => {
    const question = questionPart({ solutionItems: [] })

    expect(() =>
      buildExerciseCreatePayload(
        {
          title: 'Titre',
          level: '',
          difficulty: '',
          theme: '',
          competenciesInput: '',
          tagsInput: '',
          parts: [statementPart(), question],
        },
        EMPTY_IMAGE_MAP,
        EMPTY_IMAGE_MAP,
      ),
    ).toThrow(ExerciseFormValidationError)
  })
})

describe('buildEditableStateForExerciseEdit — pré-remplissage de l’image de solution', () => {
  function authorExercise(overrides: Partial<AuthorExerciseDetail> = {}): AuthorExerciseDetail {
    return {
      id: 'ex-1',
      title: 'Un exercice',
      tags: [],
      status: 'validated',
      authorId: 'author-1',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
      parts: [
        {
          id: 'part-statement',
          partNumber: 1,
          category: 'statement',
          items: [{ id: 'i1', type: 'text', order: 0, content: 'Énoncé' }],
          hasSolution: false,
        },
        {
          id: 'part-question',
          partNumber: 2,
          category: 'question',
          items: [{ id: 'i2', type: 'text', order: 0, content: 'Question' }],
          hasSolution: true,
          solution: {
            items: [
              { id: 's1', type: 'text', order: 0, content: 'Solution texte' },
              {
                id: 's2',
                type: 'image',
                order: 1,
                content: 'légende',
                imageMimeType: 'image/webp',
                imageData: 'AAAA',
              },
            ],
          },
        },
      ],
      ...overrides,
    }
  }

  it("pré-remplit existingSolutionImageItem quand la solution porte une image", () => {
    const state = buildEditableStateForExerciseEdit(authorExercise())
    const questionState = state.parts.find((p) => p.category === 'question')

    expect(questionState?.existingSolutionImageItem).toEqual({
      id: 's2',
      type: 'image',
      order: 1,
      content: 'légende',
      imageMimeType: 'image/webp',
      imageData: 'AAAA',
    })
    expect(questionState?.solutionImageFile).toBeNull()
  })

  it("laisse existingSolutionImageItem à null quand la solution n'a pas d'image", () => {
    const exercise = authorExercise()
    exercise.parts[1].solution = { items: [{ id: 's1', type: 'text', order: 0, content: 'Solution texte' }] }

    const state = buildEditableStateForExerciseEdit(exercise)
    const questionState = state.parts.find((p) => p.category === 'question')

    expect(questionState?.existingSolutionImageItem).toBeNull()
  })

  it("laisse existingSolutionImageItem à null quand la lecture publique (sans solution) est utilisée", () => {
    const publicDetail: PublicExerciseDetail = {
      id: 'ex-2',
      title: 'Exercice public',
      tags: [],
      status: 'validated',
      authorId: 'author-1',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
      parts: [
        {
          id: 'part-statement',
          partNumber: 1,
          category: 'statement',
          items: [],
          hasSolution: false,
        },
        {
          id: 'part-question',
          partNumber: 2,
          category: 'question',
          items: [{ id: 'i2', type: 'text', order: 0, content: 'Question' }],
          hasSolution: true,
        },
      ],
    }

    const state = buildEditableStateForExerciseEdit(publicDetail)
    const questionState = state.parts.find((p) => p.category === 'question')

    expect(questionState?.existingSolutionImageItem).toBeNull()
  })
})
