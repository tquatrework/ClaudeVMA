import { describe, it, expect } from 'vitest'
import {
  getActivityCreatorFallbackLabel,
  toScheduledActivityGridBlock,
  toScheduledActivityGridBlocks,
} from '../../src/utils/scheduledActivityGridBlocks'
import { getMondayOfWeek } from '../../src/utils/calendarDisplayWeek'
import type { CalendarActivityEntry } from '../../src/types/calendar'

// Semaine affichée : lundi 2026-09-07 → dimanche 2026-09-13 (correction du 2026-08-20, point B).
const WEEK_START = getMondayOfWeek(new Date('2026-09-10T00:00:00.000Z'))

const PROPOSED: CalendarActivityEntry = {
  id: 'activity-1',
  type: 'cours',
  status: 'proposed',
  startTime: '2026-09-10T14:00:00.000Z', // jeudi
  endTime: '2026-09-10T15:00:00.000Z',
  creatorId: 'teacher-9',
  creatorName: 'Camille Durand',
  participantIds: ['student-1'],
}

describe('toScheduledActivityGridBlock', () => {
  it('traduit une activité proposée vers un bloc PROPOSED', () => {
    const result = toScheduledActivityGridBlock(PROPOSED)

    expect(result).toMatchObject({
      id: 'activity-1',
      dayOfWeek: 4,
      startTime: '14:00',
      endTime: '15:00',
      kind: 'PROPOSED',
    })
    expect(result?.activity).toEqual(PROPOSED)
    expect(result?.dateLabel).toContain('10')
  })

  it('traduit une activité confirmée vers un bloc CONFIRMED', () => {
    const result = toScheduledActivityGridBlock({ ...PROPOSED, status: 'confirmed' })
    expect(result?.kind).toBe('CONFIRMED')
  })

  it('écrête visuellement à 23:59 une activité qui chevauche minuit', () => {
    const result = toScheduledActivityGridBlock({
      ...PROPOSED,
      startTime: '2026-09-10T22:00:00.000Z',
      endTime: '2026-09-11T01:00:00.000Z',
    })
    expect(result).toMatchObject({ dayOfWeek: 4, startTime: '22:00', endTime: '23:59' })
  })

  it('renvoie null pour un startTime illisible', () => {
    const result = toScheduledActivityGridBlock({ ...PROPOSED, startTime: 'invalid' })
    expect(result).toBeNull()
  })

  it('renvoie null pour un statut hors proposed/confirmed (garde défensive)', () => {
    // @ts-expect-error — statut hors du type contractuel, simule une dégradation serveur.
    const result = toScheduledActivityGridBlock({ ...PROPOSED, status: 'cancelled' })
    expect(result).toBeNull()
  })
})

describe('toScheduledActivityGridBlocks — filtrage par semaine calendaire réelle (point B)', () => {
  it('traduit une liste et écarte les entrées illisibles', () => {
    const result = toScheduledActivityGridBlocks(
      [PROPOSED, { ...PROPOSED, startTime: 'invalid' }],
      WEEK_START,
    )
    expect(result).toHaveLength(1)
  })

  it('renvoie une liste vide pour une entrée vide', () => {
    expect(toScheduledActivityGridBlocks([], WEEK_START)).toEqual([])
  })

  it('exclut une activité hors de la semaine affichée', () => {
    const result = toScheduledActivityGridBlocks(
      [{ ...PROPOSED, id: 'activity-next-week', startTime: '2026-09-17T14:00:00.000Z', endTime: '2026-09-17T15:00:00.000Z' }],
      WEEK_START,
    )
    expect(result).toEqual([])
  })
})

describe('getActivityCreatorFallbackLabel', () => {
  it('renvoie "Formateur" pour un cours', () => {
    expect(getActivityCreatorFallbackLabel('cours')).toBe('Formateur')
  })

  it('renvoie un texte neutre pour les autres types', () => {
    expect(getActivityCreatorFallbackLabel('reunion_pedagogique')).toBe('Intervenant pédagogique')
  })
})
