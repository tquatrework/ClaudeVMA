/**
 * Tests du dictionnaire type technique → phrase française des notifications
 * (système de notifications transversal, arbitrage du 2026-08-14).
 */

import { describe, it, expect } from 'vitest'
import { getNotificationDisplayText, getNotificationTargetPath } from '../../src/utils/notificationLabels'
import { formatEventDate } from '../../src/utils/dateFormat'

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

  it('résout teacher_proposal_not_selected — un autre formateur a été retenu', () => {
    const text = getNotificationDisplayText({
      type: 'teacher_proposal_not_selected',
      metadata: { teacherName: 'Marc Petit', studentName: 'Camille Durand' },
      title: '',
      message: '',
    })
    expect(text).toBe('Un autre professeur a été retenu pour Camille Durand')
  })

  it('résout teacher_proposal_expired — le formateur n\'a jamais répondu, distinct de not_selected', () => {
    const text = getNotificationDisplayText({
      type: 'teacher_proposal_expired',
      metadata: { teacherName: 'Marc Petit', studentName: 'Camille Durand' },
      title: '',
      message: '',
    })
    expect(text).toBe("Vous n'avez pas été retenu pour Camille Durand")
  })

  it('teacher_proposal_not_selected et teacher_proposal_expired ont des libellés distincts', () => {
    const notSelected = getNotificationDisplayText({
      type: 'teacher_proposal_not_selected',
      metadata: { studentName: 'Camille Durand' },
      title: '',
      message: '',
    })
    const expired = getNotificationDisplayText({
      type: 'teacher_proposal_expired',
      metadata: { studentName: 'Camille Durand' },
      title: '',
      message: '',
    })
    expect(notSelected).not.toBe(expired)
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

  it('résout course_slot_proposed avec le nom du proposeur (chantier calendrier, point 3)', () => {
    const text = getNotificationDisplayText({
      type: 'course_slot_proposed',
      metadata: { proposerName: 'Camille Durand' },
      title: '',
      message: '',
    })
    expect(text).toBe('Proposition de cours ajoutée par Camille Durand')
  })

  it('course_slot_proposed sans proposerName → texte neutre en français, jamais un UUID', () => {
    const text = getNotificationDisplayText({
      type: 'course_slot_proposed',
      metadata: {},
      title: '',
      message: '',
    })
    expect(text).toBe('Proposition de cours ajoutée par un intervenant')
  })

  it('résout event_invitation_received avec le type d\'événement et l\'heure, jamais le titre (ajustement du 2026-08-20)', () => {
    const text = getNotificationDisplayText({
      type: 'event_invitation_received',
      metadata: {
        creatorName: 'Camille Durand',
        title: 'Cours particulier',
        eventType: 'cours',
        startAt: '2026-08-19T14:00:00.000Z',
      },
      title: '',
      message: '',
    })
    // Le titre saisi par le créateur ne doit plus apparaître, même s'il existe.
    expect(text).not.toContain('Cours particulier')
    expect(text).toBe(
      `Camille Durand vous a invité à un événement « Cours » le ${formatEventDate('2026-08-19T14:00:00.000Z')}`,
    )
  })

  it('résout event_invitation_received sans startAt connu → pas d\'heure affichée', () => {
    const text = getNotificationDisplayText({
      type: 'event_invitation_received',
      metadata: { creatorName: 'Camille Durand', eventType: 'rappel' },
      title: '',
      message: '',
    })
    expect(text).toBe('Camille Durand vous a invité à un événement « Rappel »')
  })

  it('event_invitation_received sans eventType connu → aucun libellé de type, heure conservée', () => {
    const text = getNotificationDisplayText({
      type: 'event_invitation_received',
      metadata: { creatorName: 'Camille Durand', startAt: '2026-08-19T14:00:00.000Z' },
      title: '',
      message: '',
    })
    expect(text).toBe(
      `Camille Durand vous a invité à un événement le ${formatEventDate('2026-08-19T14:00:00.000Z')}`,
    )
  })

  it('event_invitation_received sans creatorName ni type ni heure → texte neutre en français, jamais un UUID', () => {
    const text = getNotificationDisplayText({
      type: 'event_invitation_received',
      metadata: {},
      title: '',
      message: '',
    })
    expect(text).toBe("Quelqu'un vous a invité à un événement")
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i)
  })

  // Chantier « Refonte des Évaluations », flow de demande de correction (2026-09-01/02).
  // Contrat de `metadata` : .claude/reports/dashboard-notification-service-evaluations-2026-09-02.md
  describe('flow de correction d\'Évaluation (2026-09-02)', () => {
    it('résout evaluation_correction_requested avec le nom de l\'élève', () => {
      const text = getNotificationDisplayText({
        type: 'evaluation_correction_requested',
        metadata: { studentName: 'Camille Verify' },
        title: '',
        message: '',
      })
      expect(text).toBe('Camille Verify demande une correction de son évaluation')
      expect(text).not.toBe('Nouvelle notification')
    })

    it('résout evaluation_correction_accepted avec le nom du professeur et de l\'élève', () => {
      const text = getNotificationDisplayText({
        type: 'evaluation_correction_accepted',
        metadata: { teacherName: 'prof lycee', studentName: 'Camille Verify' },
        title: '',
        message: '',
      })
      expect(text).toBe('prof lycee a pris en charge la correction de Camille Verify')
    })

    it('résout evaluation_correction_declined avec le nom du professeur et de l\'élève', () => {
      const text = getNotificationDisplayText({
        type: 'evaluation_correction_declined',
        metadata: { teacherName: 'prof superieur', studentName: 'Camille Verify' },
        title: '',
        message: '',
      })
      expect(text).toBe('prof superieur a refusé la correction de Camille Verify')
    })

    it('résout evaluation_correction_all_declined — reason: all_linked_teachers_declined', () => {
      const text = getNotificationDisplayText({
        type: 'evaluation_correction_all_declined',
        metadata: { studentName: 'Camille Verify', reason: 'all_linked_teachers_declined' },
        title: '',
        message: '',
      })
      expect(text).toBe(
        'Tous les professeurs liés ont refusé la correction de Camille Verify — à traiter manuellement',
      )
    })

    it('résout evaluation_correction_all_declined — reason: no_linked_teacher, libellé distinct', () => {
      const text = getNotificationDisplayText({
        type: 'evaluation_correction_all_declined',
        metadata: { studentName: 'Camille Verify', reason: 'no_linked_teacher' },
        title: '',
        message: '',
      })
      expect(text).toBe('Aucun professeur lié pour corriger Camille Verify — à traiter manuellement')

      const otherReasonText = getNotificationDisplayText({
        type: 'evaluation_correction_all_declined',
        metadata: { studentName: 'Camille Verify', reason: 'all_linked_teachers_declined' },
        title: '',
        message: '',
      })
      expect(text).not.toBe(otherReasonText)
    })

    it('résout evaluation_corrected avec le nom du correcteur et la note', () => {
      const text = getNotificationDisplayText({
        type: 'evaluation_corrected',
        metadata: { teacherName: 'prof lycee', score: 15, comment: 'Bien joué' },
        title: '',
        message: '',
      })
      expect(text).toBe('Votre évaluation a été corrigée par prof lycee — note : 15')
    })

    it('evaluation_corrected reste lisible sans score connu (pas de "— note : —")', () => {
      const text = getNotificationDisplayText({
        type: 'evaluation_corrected',
        metadata: { teacherName: 'prof lycee' },
        title: '',
        message: '',
      })
      expect(text).toBe('Votre évaluation a été corrigée par prof lycee')
    })

    it('aucun des 5 nouveaux types ne retombe sur le libellé générique de repli', () => {
      const types = [
        'evaluation_correction_requested',
        'evaluation_correction_accepted',
        'evaluation_correction_declined',
        'evaluation_correction_all_declined',
        'evaluation_corrected',
      ] as const

      for (const type of types) {
        const text = getNotificationDisplayText({ type, metadata: {}, title: '', message: '' })
        expect(text).not.toBe('Nouvelle notification')
        expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i)
      }
    })
  })
})

describe('getNotificationTargetPath', () => {
  it('renvoie /calendar pour course_slot_proposed', () => {
    expect(getNotificationTargetPath('course_slot_proposed')).toBe('/calendar')
  })

  it('renvoie /calendar pour event_invitation_received', () => {
    expect(getNotificationTargetPath('event_invitation_received')).toBe('/calendar')
  })

  it('renvoie /teacher-requests pour les 8 types du flow demande de professeur', () => {
    expect(getNotificationTargetPath('teacher_request_created')).toBe('/teacher-requests')
    expect(getNotificationTargetPath('teacher_assigned')).toBe('/teacher-requests')
  })

  it('renvoie null pour un type inconnu', () => {
    expect(getNotificationTargetPath('some_legacy_type')).toBeNull()
  })

  it('renvoie null pour les 5 types du flow de correction d\'Évaluation (aucun écran livré)', () => {
    expect(getNotificationTargetPath('evaluation_correction_requested')).toBeNull()
    expect(getNotificationTargetPath('evaluation_correction_accepted')).toBeNull()
    expect(getNotificationTargetPath('evaluation_correction_declined')).toBeNull()
    expect(getNotificationTargetPath('evaluation_correction_all_declined')).toBeNull()
    expect(getNotificationTargetPath('evaluation_corrected')).toBeNull()
  })
})
