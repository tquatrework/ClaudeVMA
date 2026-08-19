import { describe, it, expect } from 'vitest'
import { getCurrentWeekWindow } from '../../src/utils/calendarWeekWindow'

describe('getCurrentWeekWindow', () => {
  it("renvoie une fenêtre de 7 jours débutant au début de la journée de référence", () => {
    const reference = new Date('2026-09-10T14:32:00.000Z')
    const { from, to } = getCurrentWeekWindow(reference)

    expect(new Date(to).getTime() - new Date(from).getTime()).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('accepte une date de référence différente sans dépendre de Date.now()', () => {
    const reference = new Date('2030-01-01T00:00:00.000Z')
    const { from } = getCurrentWeekWindow(reference)

    expect(new Date(from).getUTCFullYear()).toBe(2030)
  })
})
