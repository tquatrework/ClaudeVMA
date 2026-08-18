import { describe, it, expect } from 'vitest'
import { fromApiActivity } from '../../src/utils/scheduledActivityApiMapping'
import type { ScheduledActivity } from '../../src/types/calendar'

function buildActivity(overrides: Partial<ScheduledActivity> = {}): ScheduledActivity {
  return {
    id: 'activity-1',
    title: 'Cours de géométrie',
    type: 'cours',
    creatorId: 'teacher-1',
    creatorRole: 'formateur',
    participantIds: ['student-1'],
    startTime: '2026-09-10T14:00:00.000Z',
    endTime: '2026-09-10T15:00:00.000Z',
    status: 'proposed',
    description: null,
    correlationId: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('fromApiActivity', () => {
  it('traduit startTime/endTime en startAt/endAt', () => {
    const result = fromApiActivity(buildActivity())
    expect(result.startAt).toBe('2026-09-10T14:00:00.000Z')
    expect(result.endAt).toBe('2026-09-10T15:00:00.000Z')
  })

  it("reconstitue studentId/teacherId pour un cours créé par un formateur à un seul participant", () => {
    const result = fromApiActivity(buildActivity())
    expect(result.studentId).toBe('student-1')
    expect(result.teacherId).toBe('teacher-1')
  })

  it("n'invente pas studentId/teacherId pour une réunion pédagogique", () => {
    const result = fromApiActivity(
      buildActivity({ type: 'reunion_pedagogique', creatorRole: 'animateur_pedagogique' }),
    )
    expect(result.studentId).toBeUndefined()
    expect(result.teacherId).toBeUndefined()
  })

  it("n'invente pas studentId/teacherId pour un cours créé par le RP à plusieurs participants", () => {
    const result = fromApiActivity(
      buildActivity({
        creatorRole: 'responsable_pedagogique',
        participantIds: ['teacher-1', 'teacher-2'],
      }),
    )
    expect(result.studentId).toBeUndefined()
    expect(result.teacherId).toBeUndefined()
  })

  it('conserve id/type/status tels quels', () => {
    const result = fromApiActivity(buildActivity({ status: 'confirmed' }))
    expect(result.id).toBe('activity-1')
    expect(result.type).toBe('cours')
    expect(result.status).toBe('confirmed')
  })
})
