import { describe, it, expect } from 'vitest'
import { getOwnTeacherValidationMessage } from '../../src/utils/teacherValidationLabels'
import type { TeacherValidationRecord } from '../../src/types/profile'

/**
 * getOwnTeacherValidationMessage — message affiché AU FORMATEUR sur son propre
 * statut de validation (arbitrage du 2026-08-13).
 */
describe('getOwnTeacherValidationMessage', () => {
  it('renvoie null en l\'absence d\'enregistrement', () => {
    expect(getOwnTeacherValidationMessage(null)).toBeNull()
  })

  it('confond pending et in_review sous « en attente de validation »', () => {
    const pendingRecord: TeacherValidationRecord = { teacherId: 't1', status: 'pending' }
    const inReviewRecord: TeacherValidationRecord = { teacherId: 't1', status: 'in_review' }

    const pendingMessage = getOwnTeacherValidationMessage(pendingRecord)
    const inReviewMessage = getOwnTeacherValidationMessage(inReviewRecord)

    expect(pendingMessage?.tone).toBe('pending')
    expect(inReviewMessage?.tone).toBe('pending')
    expect(pendingMessage?.message).toEqual(inReviewMessage?.message)
    expect(pendingMessage?.message).toMatch(/en attente de validation/i)
  })

  it("dérive l'année du refus depuis updatedAt et annonce l'année suivante", () => {
    const record: TeacherValidationRecord = {
      teacherId: 't1',
      status: 'rejected',
      updatedAt: '2026-03-10T08:00:00.000Z',
    }

    const result = getOwnTeacherValidationMessage(record)

    expect(result?.tone).toBe('rejected')
    expect(result?.message).toMatch(/année 2026/)
    expect(result?.message).toMatch(/représenter en 2027/)
  })

  it('reste utilisable sans updatedAt (message générique, sans année)', () => {
    const record: TeacherValidationRecord = { teacherId: 't1', status: 'rejected' }

    const result = getOwnTeacherValidationMessage(record)

    expect(result?.tone).toBe('rejected')
    expect(result?.message).not.toMatch(/undefined|NaN/)
  })

  it("n'affiche rien pour un formateur validé", () => {
    const record: TeacherValidationRecord = {
      teacherId: 't1',
      status: 'validated',
      updatedAt: '2026-03-10T08:00:00.000Z',
    }

    expect(getOwnTeacherValidationMessage(record)).toBeNull()
  })
})
