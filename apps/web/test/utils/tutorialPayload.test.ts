/**
 * Tests de `tutorialPayload.ts` — construction du payload de création/édition et pré-remplissage
 * de l'état d'édition depuis un tutoriel déjà enregistré. Même patron que `exercisePayload.test.ts`.
 */

import { describe, it, expect } from 'vitest'
import {
  buildEditableStateForTutorialEdit,
  buildTutorialCreatePayload,
  TutorialFormValidationError,
  type EditableTutorialFormState,
} from '../../src/utils/tutorialPayload'
import { createEditableTutorialBlock } from '../../src/components/content-catalog/TutorialBlockEditor'
import type { CreateTutorialBlockPayload } from '../../src/types/tutorial'
import type { PublicTutorialDetail } from '../../src/types/tutorial'

const EMPTY_IMAGE_MAP = new Map<string, CreateTutorialBlockPayload>()

function baseState(overrides: Partial<EditableTutorialFormState> = {}): EditableTutorialFormState {
  return {
    title: 'Mon tutoriel',
    tagsInput: '',
    description: '',
    level: '',
    difficulty: '',
    theme: '',
    competenciesInput: '',
    format: 'post',
    videoUrl: '',
    linkedQuizId: null,
    blocks: [],
    ...overrides,
  }
}

describe('buildTutorialCreatePayload — validations de base', () => {
  it('refuse un titre vide', () => {
    const state = baseState({ title: '   ' })
    expect(() => buildTutorialCreatePayload(state, EMPTY_IMAGE_MAP)).toThrow(
      TutorialFormValidationError,
    )
  })

  it('refuse un format vidéo sans URL', () => {
    const state = baseState({ format: 'video', videoUrl: '  ' })
    expect(() => buildTutorialCreatePayload(state, EMPTY_IMAGE_MAP)).toThrow(
      "L'adresse de la vidéo est obligatoire.",
    )
  })

  it('accepte un format vidéo avec URL et ne porte aucun bloc', () => {
    const state = baseState({ format: 'video', videoUrl: 'https://video.example.com/x' })
    const payload = buildTutorialCreatePayload(state, EMPTY_IMAGE_MAP)
    expect(payload).toEqual({
      title: 'Mon tutoriel',
      format: 'video',
      videoUrl: 'https://video.example.com/x',
    })
  })

  it('refuse un format post sans aucun bloc rempli', () => {
    const block = createEditableTutorialBlock('text')
    block.content = '   '
    const state = baseState({ format: 'post', blocks: [block] })
    expect(() => buildTutorialCreatePayload(state, EMPTY_IMAGE_MAP)).toThrow(
      'Ajoutez au moins un bloc avec du contenu (texte ou image).',
    )
  })

  it('omet silencieusement un bloc texte vide, sans le refuser individuellement', () => {
    const filled = createEditableTutorialBlock('text')
    filled.content = 'Contenu réel'
    const empty = createEditableTutorialBlock('text')
    empty.content = ''

    const state = baseState({ format: 'post', blocks: [empty, filled] })
    const payload = buildTutorialCreatePayload(state, EMPTY_IMAGE_MAP)

    expect(payload.blocks).toEqual([{ category: 'text', content: 'Contenu réel' }])
  })

  it('omet un bloc texte dont le document structuré ne porte aucun texte ni formule', () => {
    const filled = createEditableTutorialBlock('text')
    filled.content = 'Contenu réel'
    const emptyDoc = createEditableTutorialBlock('text')
    emptyDoc.content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })

    const state = baseState({ format: 'post', blocks: [emptyDoc, filled] })
    const payload = buildTutorialCreatePayload(state, EMPTY_IMAGE_MAP)

    expect(payload.blocks).toEqual([{ category: 'text', content: 'Contenu réel' }])
  })

  it('refuse un bloc image sans image résolue', () => {
    const imageBlock = createEditableTutorialBlock('image')
    const state = baseState({ format: 'post', blocks: [imageBlock] })

    expect(() => buildTutorialCreatePayload(state, EMPTY_IMAGE_MAP)).toThrow(
      'Le bloc image 1 doit contenir une image.',
    )
  })

  it('inclut le bloc image résolu dans le payload', () => {
    const imageBlock = createEditableTutorialBlock('image')
    const resolved = new Map<string, CreateTutorialBlockPayload>([
      [imageBlock.localId, { category: 'image', imageData: 'AAAA', imageOriginalFilename: 'x.png' }],
    ])
    const state = baseState({ format: 'post', blocks: [imageBlock] })

    const payload = buildTutorialCreatePayload(state, resolved)

    expect(payload.blocks).toEqual([
      { category: 'image', imageData: 'AAAA', imageOriginalFilename: 'x.png' },
    ])
  })

  it('inclut les métadonnées optionnelles seulement si renseignées', () => {
    const block = createEditableTutorialBlock('text')
    block.content = 'Contenu'
    const state = baseState({
      format: 'post',
      blocks: [block],
      tagsInput: 'fractions, géométrie',
      description: 'Une description',
      theme: 'Algèbre',
      level: 'Terminale',
      difficulty: 'facile',
      competenciesInput: 'calcul, raisonnement',
      linkedQuizId: 'quiz-123',
    })

    const payload = buildTutorialCreatePayload(state, EMPTY_IMAGE_MAP)

    expect(payload).toMatchObject({
      title: 'Mon tutoriel',
      description: 'Une description',
      theme: 'Algèbre',
      level: 'Terminale',
      difficulty: 'facile',
      competencies: ['calcul', 'raisonnement'],
      tags: ['fractions', 'géométrie'],
      linkedQuizId: 'quiz-123',
      format: 'post',
    })
  })
})

describe('buildEditableStateForTutorialEdit', () => {
  function publicTutorial(overrides: Partial<PublicTutorialDetail> = {}): PublicTutorialDetail {
    return {
      id: 'tuto-1',
      title: 'Un tutoriel',
      tags: [],
      format: 'post',
      status: 'validated',
      authorId: 'author-1',
      createdAt: '2026-09-03T00:00:00Z',
      updatedAt: '2026-09-03T00:00:00Z',
      blocks: [
        { id: 'b1', blockNumber: 1, category: 'text', content: 'Texte du bloc' },
        { id: 'b2', blockNumber: 2, category: 'image', content: 'légende', imageMimeType: 'image/webp' },
      ],
      ...overrides,
    }
  }

  it('reprend les blocs texte tels quels', () => {
    const state = buildEditableStateForTutorialEdit(publicTutorial())
    const textBlock = state.blocks.find((b) => b.category === 'text')
    expect(textBlock?.content).toBe('Texte du bloc')
  })

  it('reprend un bloc image existant dans `existingImageBlock`', () => {
    const state = buildEditableStateForTutorialEdit(publicTutorial())
    const imageBlock = state.blocks.find((b) => b.category === 'image')
    expect(imageBlock?.existingImageBlock).toEqual({
      id: 'b2',
      blockNumber: 2,
      category: 'image',
      content: 'légende',
      imageMimeType: 'image/webp',
    })
    expect(imageBlock?.imageFile).toBeNull()
  })

  it('reprend le format vidéo et l’URL', () => {
    const state = buildEditableStateForTutorialEdit(
      publicTutorial({ format: 'video', videoUrl: 'https://video.example.com/y', blocks: [] }),
    )
    expect(state.format).toBe('video')
    expect(state.videoUrl).toBe('https://video.example.com/y')
  })

  it('reprend le quizz lié', () => {
    const state = buildEditableStateForTutorialEdit(publicTutorial({ linkedQuizId: 'quiz-9' }))
    expect(state.linkedQuizId).toBe('quiz-9')
  })
})
