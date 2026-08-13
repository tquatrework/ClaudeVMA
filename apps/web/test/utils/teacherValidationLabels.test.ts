import { describe, it, expect } from 'vitest'
import {
  getOwnTeacherValidationMessage,
  isReapplyEligible,
} from '../../src/utils/teacherValidationLabels'
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

  it("affiche l'échéance de reprise de candidature depuis reapplyEligibleAt (2026-08-13)", () => {
    const record: TeacherValidationRecord = {
      teacherId: 't1',
      status: 'rejected',
      updatedAt: '2026-03-10T08:00:00.000Z',
      reapplyEligibleAt: '2026-08-01',
    }

    const result = getOwnTeacherValidationMessage(record)

    expect(result?.tone).toBe('rejected')
    expect(result?.message).toMatch(/1er août 2026/)
  })

  it('reste utilisable sans reapplyEligibleAt (message générique)', () => {
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

/**
 * isReapplyEligible — le bouton de relance n'apparaît qu'après l'échéance
 * annoncée par le serveur (arbitrage du 2026-08-13).
 */
describe('isReapplyEligible', () => {
  it('est faux en l\'absence d\'enregistrement', () => {
    expect(isReapplyEligible(null)).toBe(false)
  })

  it('est faux pour un statut autre que rejected', () => {
    const record: TeacherValidationRecord = {
      teacherId: 't1',
      status: 'pending',
      reapplyEligibleAt: '2020-01-01',
    }
    expect(isReapplyEligible(record)).toBe(false)
  })

  it('est faux tant que reapplyEligibleAt est absent', () => {
    const record: TeacherValidationRecord = { teacherId: 't1', status: 'rejected' }
    expect(isReapplyEligible(record)).toBe(false)
  })

  it('est faux avant la date d\'échéance', () => {
    const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString()
    const record: TeacherValidationRecord = {
      teacherId: 't1',
      status: 'rejected',
      reapplyEligibleAt: farFuture,
    }
    expect(isReapplyEligible(record)).toBe(false)
  })

  it('est vrai une fois la date d\'échéance passée', () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    const record: TeacherValidationRecord = {
      teacherId: 't1',
      status: 'rejected',
      reapplyEligibleAt: past,
    }
    expect(isReapplyEligible(record)).toBe(true)
  })
})
