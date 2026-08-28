import { describe, it, expect } from 'vitest'
import { buildEditableStateForEdit, buildQuizCreatePayload } from '../../src/utils/quizPayload'
import { createEditableQuestion } from '../../src/components/content-catalog/QuizQuestionEditor'
import type { EditableQuizQuestion } from '../../src/components/content-catalog/QuizQuestionEditor'
import type { AuthorQuizDetail } from '../../src/types/quiz'

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

describe('buildEditableStateForEdit', () => {
  // `AuthorQuizDetail` — forme réelle de `GET /quizzes/:id/solution` (PR #167
  // content-catalog-service, mergée et déployée, vérifiée en HTTP direct le 2026-08-28) :
  // `isCorrect` sur les options, `keywords` sur les questions à texte court.
  function authorQuiz(overrides: Partial<AuthorQuizDetail> = {}): AuthorQuizDetail {
    return {
      id: 'quiz-1',
      title: 'Un quizz',
      description: 'une description',
      tags: ['fractions', 'géométrie'],
      status: 'validated',
      authorId: 'author-1',
      authorRole: 'formateur',
      defaultPoints: 2,
      penaltyEnabled: false,
      penaltyPoints: 0,
      createdAt: '2026-08-28T00:00:00Z',
      updatedAt: '2026-08-28T00:00:00Z',
      questions: [
        {
          id: 'q1',
          order: 1,
          category: 'single_choice',
          prompt: 'Que vaut $x^2$ quand $x = 3$ ?',
          options: [
            { id: 'o1', text: '$8$', isCorrect: false },
            { id: 'o2', text: '$9$', isCorrect: true },
          ],
          points: 2,
          penaltyEnabled: false,
        },
      ],
      ...overrides,
    }
  }

  it('pré-remplit le titre, la description, les tags et le barème global', () => {
    const state = buildEditableStateForEdit(authorQuiz())

    expect(state.title).toBe('Un quizz')
    expect(state.description).toBe('une description')
    expect(state.tagsInput).toBe('fractions, géométrie')
    expect(state.defaultPoints).toBe('2')
    expect(state.penaltyEnabled).toBe(false)
  })

  it('pré-remplit le texte des options et leur caractère correct réel (GET /quizzes/:id/solution)', () => {
    const state = buildEditableStateForEdit(authorQuiz())
    const [question] = state.questions

    expect(question.prompt).toBe('Que vaut $x^2$ quand $x = 3$ ?')
    expect(question.options.map((o) => o.text)).toEqual(['$8$', '$9$'])
    expect(question.options.map((o) => o.isCorrect)).toEqual([false, true])
  })

  it('pré-remplit les mots-clés déjà saisis pour une question à texte court', () => {
    const quiz = authorQuiz({
      questions: [
        {
          id: 'q1',
          order: 1,
          category: 'short_text',
          prompt: 'Capitale de la France ?',
          keywords: ['paris', 'capitale'],
          points: 2,
          penaltyEnabled: false,
        },
      ],
    })

    const state = buildEditableStateForEdit(quiz)

    expect(state.questions[0].keywordsInput).toBe('paris, capitale')
  })

  it('déduit hasOverride quand le barème effectif de la question diverge du réglage global', () => {
    const quiz = authorQuiz({
      defaultPoints: 1,
      questions: [
        {
          id: 'q1',
          order: 1,
          category: 'single_choice',
          prompt: 'Question à barème spécifique',
          options: [{ id: 'o1', text: 'A', isCorrect: true }],
          points: 5,
          penaltyEnabled: false,
        },
      ],
    })

    const state = buildEditableStateForEdit(quiz)

    expect(state.questions[0].hasOverride).toBe(true)
    expect(state.questions[0].pointsOverrideInput).toBe('5')
  })

  it('ne déduit pas hasOverride quand le barème effectif suit le réglage global', () => {
    const state = buildEditableStateForEdit(authorQuiz({ defaultPoints: 2 }))

    expect(state.questions[0].hasOverride).toBe(false)
    expect(state.questions[0].pointsOverrideInput).toBe('')
  })
})
