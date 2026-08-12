/**
 * Point unique de libellés du flow « demande de professeur ».
 *
 * La table statut → libellé vivait en cinq exemplaires, avec deux contenus différents :
 * un statut connu d'un écran produisait un badge **vide** sur un autre. Ces tests
 * verrouillent la complétude, pour les statuts du flow comme pour ceux hérités.
 */

import { describe, it, expect } from 'vitest'
import {
  TEACHER_PROPOSAL_STATUS_COLORS,
  TEACHER_PROPOSAL_STATUS_LABELS,
  TEACHER_REQUEST_STATUS_COLORS,
  TEACHER_REQUEST_STATUS_LABELS,
  getTeacherDisplayName,
  getTeacherProposalStatusColor,
  getTeacherProposalStatusLabel,
  getTeacherRequestStatusColor,
  getTeacherRequestStatusLabel,
  getTeacherRequestTitle,
} from '../../src/utils/teacherRequestLabels'
import type {
  TeacherProposalStatus,
  TeacherRequestStatus,
} from '../../src/types/teacherRequests'

const ALL_REQUEST_STATUSES: TeacherRequestStatus[] = [
  'pending',
  'redirected',
  'closed',
  'cancelled',
  'declined',
  'assigned',
  'accepted',
  'candidates_published',
  'candidates_selected',
  'candidate_chosen',
]

const ALL_PROPOSAL_STATUSES: TeacherProposalStatus[] = [
  'pending',
  'accepted',
  'declined',
  'not_selected',
  'expired',
]

describe('teacherRequestLabels — statuts de demande', () => {
  it('donne un libellé français à tous les statuts, flow et héritage compris', () => {
    for (const status of ALL_REQUEST_STATUSES) {
      expect(TEACHER_REQUEST_STATUS_LABELS[status]).toBeTruthy()
      expect(getTeacherRequestStatusLabel(status)).not.toBe(status)
    }
  })

  it('donne une classe de couleur non vide à tous les statuts', () => {
    for (const status of ALL_REQUEST_STATUSES) {
      expect(TEACHER_REQUEST_STATUS_COLORS[status]).toBeTruthy()
      expect(getTeacherRequestStatusColor(status).trim().length).toBeGreaterThan(0)
    }
  })

  it('nomme les trois statuts créés par la refonte du flow', () => {
    expect(getTeacherRequestStatusLabel('redirected')).toBe('Proposée à des formateurs')
    expect(getTeacherRequestStatusLabel('closed')).toBe('Professeur trouvé')
    expect(getTeacherRequestStatusLabel('pending')).toBe('En attente')
  })

  it('retombe sur la valeur brute et une couleur neutre pour un statut inconnu', () => {
    expect(getTeacherRequestStatusLabel('statut_inedit')).toBe('statut_inedit')
    expect(getTeacherRequestStatusColor('statut_inedit')).toBe('bg-gray-100 text-gray-500')
  })
})

describe('teacherRequestLabels — statuts de proposition', () => {
  it('donne un libellé et une couleur à chaque statut', () => {
    for (const status of ALL_PROPOSAL_STATUSES) {
      expect(TEACHER_PROPOSAL_STATUS_LABELS[status]).toBeTruthy()
      expect(TEACHER_PROPOSAL_STATUS_COLORS[status]).toBeTruthy()
    }
  })

  it('distingue « non retenu », « sans réponse » et « a refusé »', () => {
    // Les confondre serait un mensonge affiché au formateur : `declined` signifie
    // que le formateur a refusé, pas qu'on ne l'a pas retenu.
    const notSelected = getTeacherProposalStatusLabel('not_selected')
    const expired = getTeacherProposalStatusLabel('expired')
    const declined = getTeacherProposalStatusLabel('declined')

    expect(new Set([notSelected, expired, declined]).size).toBe(3)
    expect(declined).toBe('A refusé')
  })

  it('retombe sur une couleur neutre pour un statut inconnu', () => {
    expect(getTeacherProposalStatusColor('inconnu')).toBe('bg-gray-100 text-gray-500')
  })
})

describe('teacherRequestLabels — libellés de personnes', () => {
  it("affiche le nom de l'élève quand le serveur l'a résolu", () => {
    expect(getTeacherRequestTitle('Lea Bertrand')).toBe('Lea Bertrand')
  })

  it("n'expose jamais d'identifiant technique quand le nom manque", () => {
    expect(getTeacherRequestTitle(null)).toBe('Élève (nom non renseigné)')
    expect(getTeacherRequestTitle('   ')).toBe('Élève (nom non renseigné)')
    expect(getTeacherDisplayName(undefined)).toBe('Formateur (nom non renseigné)')
  })
})
