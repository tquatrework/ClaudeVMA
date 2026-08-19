import { describe, it, expect } from 'vitest'
import {
  getActivityStatusLabel,
  getActivityTypeLabel,
  ACTIVITY_STATUS_BADGE_CLASSES,
} from '../../src/utils/activityLabels'
import type { ActivityStatus, ActivityType } from '../../src/types/calendar'

describe('getActivityTypeLabel', () => {
  it('traduit chaque type connu en français', () => {
    const cases: Array<[ActivityType, string]> = [
      ['cours', 'Cours'],
      ['reunion_pedagogique', 'Réunion pédagogique'],
      ['entretien_rp', 'Entretien avec le responsable pédagogique'],
      ['rappel', 'Rappel'],
      ['autre', 'Autre'],
    ]
    for (const [type, label] of cases) {
      expect(getActivityTypeLabel(type)).toBe(label)
    }
  })
})

describe('getActivityStatusLabel', () => {
  it('traduit chaque statut connu en français', () => {
    const cases: Array<[ActivityStatus, string]> = [
      ['proposed', 'En attente de réponse'],
      ['confirmed', 'Accepté'],
      ['cancelled', 'Refusé'],
      ['completed', 'Terminé'],
    ]
    for (const [status, label] of cases) {
      expect(getActivityStatusLabel(status)).toBe(label)
    }
  })
})

describe('ACTIVITY_STATUS_BADGE_CLASSES', () => {
  it('déclare une classe pour chaque statut', () => {
    const statuses: ActivityStatus[] = ['proposed', 'confirmed', 'cancelled', 'completed']
    for (const status of statuses) {
      expect(ACTIVITY_STATUS_BADGE_CLASSES[status]).toBeTruthy()
    }
  })
})
