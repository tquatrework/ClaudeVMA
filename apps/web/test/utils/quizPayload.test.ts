import { describe, it, expect } from 'vitest'
import { buildQuizCreatePayload } from '../../src/utils/quizPayload'
import { createEditableQuestion } from '../../src/components/content-catalog/QuizQuestionEditor'
import type { EditableQuizQuestion } from '../../src/components/content-catalog/QuizQuestionEditor'

function singleChoiceQuestion(overrides: Partial<EditableQuizQuestion> = {}): EditableQuizQuestion {
  const base = createEditableQuestion()
  return {
    ...base,
    prompt: '2 + 2 = ?',
    options: [
      { localId: 'a', text: '3', isCorrect: false },
      { localId: 'b', text: '4', isCorrect: true },
    ],
    ...overrides,
  }
}

describe('buildQuizCreatePayload', () => {
  it('lève une erreur si le titre est vide', () => {
    expect(() =>
      buildQuizCreatePayload('', '', '', '1', false, '', [singleChoiceQuestion()]),
    ).toThrow('Le titre est obligatoire.')
  })

  it("lève une erreur si aucune question n'est fournie", () => {
    expect(() => buildQuizCreatePayload('Titre', '', '', '1', false, '', [])).toThrow(
      'Ajoutez au moins une question.',
    )
  })

  it("lève une erreur si l'énoncé d'une question est vide", () => {
    const question = singleChoiceQuestion({ prompt: '   ' })
    expect(() =>
      buildQuizCreatePayload('Titre', '', '', '1', false, '', [question]),
    ).toThrow("L'énoncé de la question 1 est vide.")
  })

  it('lève une erreur si un choix unique n\'a pas exactement une bonne réponse', () => {
    const question = singleChoiceQuestion({
      options: [
        { localId: 'a', text: '3', isCorrect: false },
        { localId: 'b', text: '4', isCorrect: false },
      ],
    })
    expect(() => buildQuizCreatePayload('Titre', '', '', '1', false, '', [question])).toThrow(
      /exactement une bonne réponse/,
    )
  })

  it("lève une erreur si un choix multiple n'a aucune bonne réponse", () => {
    const question = singleChoiceQuestion({
      category: 'multiple_choice',
      options: [
        { localId: 'a', text: '2', isCorrect: false },
        { localId: 'b', text: '3', isCorrect: false },
      ],
    })
    expect(() => buildQuizCreatePayload('Titre', '', '', '1', false, '', [question])).toThrow(
      /au moins une bonne réponse/,
    )
  })

  it("lève une erreur si une question texte court n'a aucun mot-clé", () => {
    const question = singleChoiceQuestion({ category: 'short_text', keywordsInput: '   ' })
    expect(() => buildQuizCreatePayload('Titre', '', '', '1', false, '', [question])).toThrow(
      /au moins un mot-clé/,
    )
  })

  it('construit un payload complet et normalisé (tags, mots-clés, overrides)', () => {
    const shortTextQuestion = singleChoiceQuestion({
      category: 'short_text',
      prompt: 'Capitale de la France ?',
      keywordsInput: ' paris , capitale ',
      hasOverride: true,
      pointsOverrideInput: '3',
      penaltyEnabledOverride: true,
      penaltyPointsOverrideInput: '1.5',
    })

    const payload = buildQuizCreatePayload(
      ' Mon quizz ',
      ' une description ',
      ' fractions , géométrie ',
      '2',
      true,
      '1',
      [shortTextQuestion],
    )

    expect(payload).toEqual({
      title: 'Mon quizz',
      description: 'une description',
      tags: ['fractions', 'géométrie'],
      defaultPoints: 2,
      penaltyEnabled: true,
      penaltyPoints: 1,
      questions: [
        {
          category: 'short_text',
          prompt: 'Capitale de la France ?',
          keywords: ['paris', 'capitale'],
          shortTextScoringMode: 'all_or_nothing',
          pointsOverride: 3,
          penaltyEnabledOverride: true,
          penaltyPointsOverride: 1.5,
        },
      ],
    })
  })

  it('omet les champs optionnels absents (description, tags, overrides)', () => {
    const question = singleChoiceQuestion()

    const payload = buildQuizCreatePayload('Titre', '', '', '', false, '', [question])

    expect(payload.description).toBeUndefined()
    expect(payload.tags).toBeUndefined()
    expect(payload.defaultPoints).toBeUndefined()
    expect(payload.penaltyPoints).toBeUndefined()
    expect(payload.questions[0]).not.toHaveProperty('pointsOverride')
    expect(payload.questions[0]).not.toHaveProperty('penaltyEnabledOverride')
  })
})
