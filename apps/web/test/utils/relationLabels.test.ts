/**
 * Tests — point unique des libellés du lien de financement (`src/utils/relationLabels.ts`).
 *
 * Deux exigences produit s'y jouent :
 *   - aucun UUID ne doit pouvoir servir de libellé, même quand le profil
 *     administratif de la personne manque ;
 *   - le message d'échec d'une rupture reste en français et ne suppose **aucune**
 *     des deux causes du `404` (lien inexistant / appelant sans droit), que le
 *     serveur rend volontairement indiscernables.
 */

import { describe, it, expect } from 'vitest'
import {
  describeFinanceLinkCounterpart,
  describeUnlinkConsequence,
  describeUnlinkFailure,
  FINANCE_OWNER_GENERIC_LABEL,
  STUDENT_GENERIC_LABEL,
  UNLINK_ACTION_LABEL,
} from '../../src/utils/relationLabels'
import type { FinanceOwnerStudentLink } from '../../src/types/relations'

const FINANCE_OWNER_ID = 'ee7c85dc-1234-4abc-9def-000000000000'
const STUDENT_ID = '3f2a1b40-1111-4aaa-8bbb-000000000001'

const BASE_LINK: FinanceOwnerStudentLink = {
  financeOwnerId: FINANCE_OWNER_ID,
  studentId: STUDENT_ID,
  createdAt: '2026-01-10T10:00:00.000Z',
}

describe('describeFinanceLinkCounterpart', () => {
  it("nomme le parent financeur quand l'élève regarde", () => {
    expect(
      describeFinanceLinkCounterpart(
        { ...BASE_LINK, financeOwnerName: { firstName: 'Jean', lastName: 'Martin' } },
        'student',
      ),
    ).toBe('Jean Martin')
  })

  it("nomme l'élève quand le parent financeur regarde", () => {
    expect(
      describeFinanceLinkCounterpart(
        { ...BASE_LINK, studentName: { firstName: 'Lucas', lastName: 'Martin' } },
        'finance_owner',
      ),
    ).toBe('Lucas Martin')
  })

  it('retombe sur un libellé de rôle, jamais sur un UUID, sans profil administratif', () => {
    const studentSideLabel = describeFinanceLinkCounterpart(
      { ...BASE_LINK, financeOwnerName: null },
      'student',
    )
    const financeOwnerSideLabel = describeFinanceLinkCounterpart(
      { ...BASE_LINK, studentName: null },
      'finance_owner',
    )

    expect(studentSideLabel).toContain(FINANCE_OWNER_GENERIC_LABEL)
    expect(financeOwnerSideLabel).toContain(STUDENT_GENERIC_LABEL)
    expect(studentSideLabel).not.toContain(FINANCE_OWNER_ID)
    expect(financeOwnerSideLabel).not.toContain(STUDENT_ID)
  })

  it('accepte un nom partiel sans laisser de trou dans le libellé', () => {
    expect(
      describeFinanceLinkCounterpart(
        { ...BASE_LINK, studentName: { firstName: 'Lucas', lastName: null } },
        'finance_owner',
      ),
    ).toBe('Lucas')
  })
})

describe('describeUnlinkConsequence', () => {
  it('dit à l\'élève que la personne perdra l\'accès à SES données', () => {
    expect(describeUnlinkConsequence('student')).toContain("Cette personne n'aura plus accès")
  })

  it('dit au parent financeur que c\'est LUI qui perdra l\'accès', () => {
    expect(describeUnlinkConsequence('finance_owner')).toContain("Vous n'aurez plus accès")
  })
})

describe('describeUnlinkFailure', () => {
  it('nomme les deux causes possibles du 404 sans en choisir une', () => {
    const message = describeUnlinkFailure({
      response: {
        status: 404,
        data: { message: 'Aucun lien de financement trouvé entre ces deux personnes' },
      },
    })

    expect(message).toContain("il n'existe plus")
    expect(message).toContain('il ne vous appartient pas')
  })

  it('reste en français sur une panne serveur', () => {
    expect(describeUnlinkFailure({ response: { status: 500, data: {} } })).toBe(
      'Le serveur rencontre un problème. Veuillez réessayer plus tard.',
    )
  })

  it('reste en français quand aucune réponse ne revient', () => {
    expect(describeUnlinkFailure({ request: {} })).toBe(
      'Impossible de contacter le serveur. Vérifiez votre connexion.',
    )
  })
})

describe('UNLINK_ACTION_LABEL', () => {
  it('retient « Délier » — la personne n\'est pas supprimée, le lien est rompu', () => {
    expect(UNLINK_ACTION_LABEL).toBe('Délier')
  })
})
