import { TeacherValidation } from '../../../src/profiles/entities/teacher-validation.entity';
import {
  computeReapplyEligibleAt,
  formatFrenchDate,
  toTeacherValidationView,
} from '../../../src/profiles/teacher-validation.view';

/**
 * Arbitrage du 2026-08-13, docs/architecture.md > « Reprise de candidature
 * après un refus formateur ».
 *
 * Année scolaire : du 1er août (inclus) de l'année N au 31 juillet (inclus)
 * de l'année N+1. Un refus en août-décembre N appartient à l'année scolaire
 * [1er août N, 31 juillet N+1] → reprise possible le 1er août N+1. Un refus
 * en janvier-juillet N appartient à l'année scolaire précédente
 * [1er août N-1, 31 juillet N] → reprise possible le 1er août N.
 */
describe('computeReapplyEligibleAt', () => {
  it.each([
    // [mois du refus, jour, refus au mois M >= 8 (août à décembre)]
    ['2026-08-01T00:00:00.000Z', 2027], // borne basse d'août
    ['2026-08-31T23:59:59.999Z', 2027],
    ['2026-09-15T10:00:00.000Z', 2027],
    ['2026-11-30T00:00:00.000Z', 2027],
    ['2026-12-01T00:00:00.000Z', 2027],
    ['2026-12-31T23:59:59.999Z', 2027],
  ])('refus le %s (août à décembre) → éligible le 1er août %i', (rejectedAtIso, expectedYear) => {
    const eligibleAt = computeReapplyEligibleAt(new Date(rejectedAtIso));
    expect(eligibleAt).toEqual(new Date(Date.UTC(expectedYear, 7, 1)));
  });

  it.each([
    ['2027-01-01T00:00:00.000Z', 2027], // borne basse de janvier
    ['2027-03-15T00:00:00.000Z', 2027],
    ['2027-07-01T00:00:00.000Z', 2027],
    ['2027-07-31T23:59:59.999Z', 2027], // borne haute de juillet
  ])('refus le %s (janvier à juillet) → éligible le 1er août %i', (rejectedAtIso, expectedYear) => {
    const eligibleAt = computeReapplyEligibleAt(new Date(rejectedAtIso));
    expect(eligibleAt).toEqual(new Date(Date.UTC(expectedYear, 7, 1)));
  });

  it('handles the exact school-year boundary: 31 July vs 1 August of the same civil year', () => {
    const endOfSchoolYear = computeReapplyEligibleAt(new Date('2026-07-31T23:59:59.999Z'));
    const startOfNextSchoolYear = computeReapplyEligibleAt(new Date('2026-08-01T00:00:00.000Z'));

    expect(endOfSchoolYear).toEqual(new Date(Date.UTC(2026, 7, 1)));
    expect(startOfNextSchoolYear).toEqual(new Date(Date.UTC(2027, 7, 1)));
  });
});

describe('formatFrenchDate', () => {
  it('formats a date as jj/mm/aaaa', () => {
    expect(formatFrenchDate(new Date(Date.UTC(2027, 7, 1)))).toBe('01/08/2027');
  });
});

describe('toTeacherValidationView', () => {
  const base: TeacherValidation = {
    id: 'v-uuid',
    teacherId: 'teacher-uuid',
    status: 'pending',
    validatedBy: null as unknown as string,
    validatorRole: null as unknown as TeacherValidation['validatorRole'],
    comment: null as unknown as string,
    createdAt: new Date('2026-09-15T10:00:00.000Z'),
    updatedAt: new Date('2026-09-15T10:00:00.000Z'),
  };

  it('omits reapplyEligibleAt for pending/in_review/validated statuses', () => {
    for (const status of ['pending', 'in_review', 'validated'] as const) {
      const view = toTeacherValidationView({ ...base, status });
      expect(view).not.toHaveProperty('reapplyEligibleAt');
    }
  });

  it('adds reapplyEligibleAt, derived from createdAt, when status is rejected', () => {
    const view = toTeacherValidationView({ ...base, status: 'rejected' });
    expect(view.reapplyEligibleAt).toEqual(new Date(Date.UTC(2027, 7, 1)));
  });

  it('keeps the existing field names unchanged (id, teacherId, status, comment, validatedBy, createdAt, updatedAt)', () => {
    const view = toTeacherValidationView(base);
    expect(Object.keys(view).sort()).toEqual(
      [
        'id',
        'teacherId',
        'status',
        'validatedBy',
        'validatorRole',
        'comment',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
  });
});
