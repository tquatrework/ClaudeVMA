/**
 * Tests du dictionnaire type technique → phrase française des notifications
 * (système de notifications transversal, arbitrage du 2026-08-14).
 */

import { describe, it, expect } from 'vitest'
import { getNotificationDisplayText } from '../../src/utils/notificationLabels'

describe('getNotificationDisplayText', () => {
  it('résout teacher_request_created avec le nom de l\'élève', () => {
    const text = getNotificationDisplayText({
      type: 'teacher_request_created',
      metadata: { studentName: 'Camille Durand' },
      title: '',
      message: '',
    })
    expect(text).toBe('Nouvelle demande de professeur pour Camille Durand')
  })

  it('résout teacher_proposal_accepted avec le nom du formateur et de l\'élève', () => {
    const text = getNotificationDisplayText({
      type: 'teacher_proposal_accepted',
      metadata: { teacherName: 'Marc Petit', studentName: 'Camille Durand' },
      title: '',
      message: '',
    })
    expect(text).toBe('Marc Petit a accepté la proposition pour Camille Durand')
  })

  it('résout teacher_proposal_declined', () => {
    const text = getNotificationDisplayText({
      type: 'teacher_proposal_declined',
      metadata: { teacherName: 'Marc Petit', studentName: 'Camille Durand' },
      title: '',
      message: '',
    })
    expect(text).toBe('Marc Petit a refusé la proposition pour Camille Durand')
  })

  it('résout teacher_proposal_not_selected', () => {
    const text = getNotificationDisplayText({
      type: 'teacher_proposal_not_selected',
      metadata: { teacherName: 'Marc Petit', studentName: 'Camille Durand' },
      title: '',
      message: '',
    })
    expect(text).toBe("Marc Petit n'a pas été retenu pour Camille Durand")
  })

  it('résout teacher_proposal_expired', () => {
    const text = getNotificationDisplayText({
      type: 'teacher_proposal_expired',
      metadata: { teacherName: 'Marc Petit', studentName: 'Camille Durand' },
      title: '',
      message: '',
    })
    expect(text).toBe('La proposition envoyée à Marc Petit pour Camille Durand est restée sans réponse')
  })

  it('résout teacher_request_status_updated', () => {
    const text = getNotificationDisplayText({
      type: 'teacher_request_status_updated',
      metadata: { studentName: 'Camille Durand' },
      title: '',
      message: '',
    })
    expect(text).toBe('Le statut de la demande de professeur de Camille Durand a changé')
  })

  it('teacher_assigned distingue le formateur (« vous ») de l\'élève/parent', () => {
    const forStudent = getNotificationDisplayText(
      { type: 'teacher_assigned', metadata: { studentName: 'Camille Durand' }, title: '', message: '' },
      'eleve',
    )
    expect(forStudent).toBe('Un professeur a été trouvé pour Camille Durand')

    const forTeacher = getNotificationDisplayText(
      { type: 'teacher_assigned', metadata: { studentName: 'Camille Durand' }, title: '', message: '' },
      'formateur',
    )
    expect(forTeacher).toBe('Vous êtes désormais le professeur de Camille Durand')
  })

  it("n'affiche jamais un UUID : nom manquant → texte neutre en français", () => {
    const text = getNotificationDisplayText({
      type: 'teacher_proposal_accepted',
      metadata: {},
      title: '',
      message: '',
    })
    expect(text).toBe('un formateur a accepté la proposition pour un élève')
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i)
  })

  it('retombe sur title/message pour un type inconnu (hérité ou futur)', () => {
    const withTitle = getNotificationDisplayText({
      type: 'some_legacy_type',
      metadata: null,
      title: 'Titre serveur',
      message: 'Message serveur',
    })
    expect(withTitle).toBe('Titre serveur')

    const withMessageOnly = getNotificationDisplayText({
      type: 'some_legacy_type',
      metadata: null,
      title: '',
      message: 'Message serveur',
    })
    expect(withMessageOnly).toBe('Message serveur')
  })

  it('affiche un texte neutre si type inconnu et rien de résolu', () => {
    const text = getNotificationDisplayText({
      type: 'some_legacy_type',
      metadata: null,
      title: '',
      message: '',
    })
    expect(text).toBe('Nouvelle notification')
  })
})
