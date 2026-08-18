/**
 * Tests de la traduction représentation front ↔ contrat réel de calendar-service.
 *
 * Contrat vérifié par appel HTTP réel le 2026-08-18 : `startTime`/`endTime` en ISO 8601 complet,
 * `kind`/`recurrence` en minuscules — voir l'en-tête de `src/utils/availabilitySlotApiMapping.ts`.
 */

import { describe, it, expect } from 'vitest'
import {
  buildIsoDateTimeForDay,
  extractTimeOfDayFromIso,
  fromApiSlot,
  toApiCreatePayload,
  toApiUpdatePayload,
} from '../../src/utils/availabilitySlotApiMapping'
import type { AvailabilitySlotApi, CreateAvailabilitySlotPayload } from '../../src/types/calendar'

describe('buildIsoDateTimeForDay', () => {
  it('construit une date ISO 8601 complète en UTC pour le jour de semaine demandé', () => {
    // 2026-08-18 (référence) est un mardi (dayOfWeek 2).
    const reference = new Date('2026-08-18T00:00:00.000Z')

    const iso = buildIsoDateTimeForDay(2, '10:00', reference)

    expect(iso).toBe('2026-08-18T10:00:00.000Z')
  })

  it("avance jusqu'à la prochaine occurrence du jour de semaine demandé", () => {
    // 2026-08-18 est un mardi (2) ; lundi (1) prochain est le 2026-08-24.
    const reference = new Date('2026-08-18T00:00:00.000Z')

    const iso = buildIsoDateTimeForDay(1, '09:00', reference)

    expect(iso).toBe('2026-08-24T09:00:00.000Z')
  })

  it('lève une erreur pour une heure invalide', () => {
    expect(() => buildIsoDateTimeForDay(1, 'not-a-time')).toThrow()
  })
})

describe('extractTimeOfDayFromIso', () => {
  it('extrait HH:mm en UTC depuis une date ISO 8601 complète', () => {
    expect(extractTimeOfDayFromIso('2026-08-24T09:30:00.000Z')).toBe('09:30')
  })

  it('renvoie null pour une chaîne non exploitable', () => {
    expect(extractTimeOfDayFromIso('not-a-date')).toBeNull()
  })
})

describe('fromApiSlot', () => {
  it('traduit un créneau reçu du serveur (ISO, minuscules) vers la représentation front', () => {
    const apiSlot: AvailabilitySlotApi = {
      id: 'slot-1',
      ownerId: 'owner-1',
      dayOfWeek: 1,
      startTime: '2026-08-24T09:00:00.000Z',
      endTime: '2026-08-24T10:30:00.000Z',
      recurrence: 'weekly',
      recurrenceEndDate: '2026-12-31T00:00:00.000Z',
      kind: 'unavailable',
      createdAt: '2026-08-18T13:00:00.000Z',
    }

    expect(fromApiSlot(apiSlot)).toEqual({
      id: 'slot-1',
      ownerId: 'owner-1',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:30',
      recurrence: 'WEEKLY',
      recurrenceEndDate: '2026-12-31T00:00:00.000Z',
      kind: 'UNAVAILABLE',
      createdAt: '2026-08-18T13:00:00.000Z',
      updatedAt: undefined,
    })
  })
})

describe('toApiCreatePayload', () => {
  it('traduit un payload front en corps réel — ISO complet, enums minuscules', () => {
    const payload: CreateAvailabilitySlotPayload = {
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      recurrence: 'WEEKLY',
      recurrenceEndDate: null,
      kind: 'AVAILABLE',
    }

    const apiPayload = toApiCreatePayload(payload)

    expect(apiPayload.dayOfWeek).toBe(1)
    expect(apiPayload.recurrence).toBe('weekly')
    expect(apiPayload.kind).toBe('available')
    expect(apiPayload.recurrenceEndDate).toBeNull()
    expect(apiPayload.startTime).toMatch(/T09:00:00\.000Z$/)
    expect(apiPayload.endTime).toMatch(/T10:00:00\.000Z$/)
  })

  it('traduit NONE/UNAVAILABLE en none/unavailable', () => {
    const payload: CreateAvailabilitySlotPayload = {
      dayOfWeek: 5,
      startTime: '14:00',
      endTime: '15:00',
      recurrence: 'NONE',
      kind: 'UNAVAILABLE',
    }

    const apiPayload = toApiCreatePayload(payload)

    expect(apiPayload.recurrence).toBe('none')
    expect(apiPayload.kind).toBe('unavailable')
  })
})

describe('toApiUpdatePayload', () => {
  it('ne traduit que les champs présents dans le corps partiel', () => {
    const apiPayload = toApiUpdatePayload({ endTime: '11:00' }, 1)

    expect(Object.keys(apiPayload)).toEqual(['endTime'])
    expect(apiPayload.endTime).toMatch(/T11:00:00\.000Z$/)
  })

  it('utilise le dayOfWeek du payload plutôt que le repli quand il est fourni', () => {
    const apiPayload = toApiUpdatePayload({ dayOfWeek: 3, startTime: '08:00' }, 1)

    expect(apiPayload.dayOfWeek).toBe(3)
    expect(apiPayload.startTime).toMatch(/T08:00:00\.000Z$/)
  })

  it('traduit kind et recurrence en minuscules', () => {
    const apiPayload = toApiUpdatePayload({ kind: 'UNAVAILABLE', recurrence: 'BIWEEKLY' }, 1)

    expect(apiPayload).toEqual({ kind: 'unavailable', recurrence: 'biweekly' })
  })

  it('laisse passer recurrenceEndDate null tel quel', () => {
    const apiPayload = toApiUpdatePayload({ recurrenceEndDate: null }, 1)

    expect(apiPayload).toEqual({ recurrenceEndDate: null })
  })
})
