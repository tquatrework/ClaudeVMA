/**
 * Tests de `utils/relationAccess` et de l'accès de navigation à /archives.
 *
 * L'asymétrie testée ici est celle de l'arbitrage du 2026-08-11 : les liens
 * `teacher_of_student`, `finance_owner_of_student`, `animator_of_teacher` et
 * `coordinator_of_student` **ouvrent** les archives ; leurs symétriques
 * (`student_of_teacher`, `student_of_finance_owner`, `teacher_of_animator`…)
 * n'ouvrent que les statistiques.
 *
 * Ces fonctions ne décident d'aucun droit : elles disent seulement ce que l'écran
 * a le droit de PROPOSER. Le serveur reste seul juge, et répond 404 aux refus.
 */

import { describe, it, expect } from 'vitest'
import {
  RELATION_KIND_LABELS,
  canRelationsOpenArchives,
  describeRelations,
  isAdministratorRole,
} from '../../src/utils/relationAccess'
import { canAccess } from '../../src/navigation/navigationFilters'
import type { ContactRelation, RelationKind } from '../../src/types/relations'

const relation = (kind: RelationKind): ContactRelation[] => [{ kind }]

describe('canRelationsOpenArchives — liens qui ouvrent les archives', () => {
  it.each<RelationKind>([
    'teacher_of_student',
    'finance_owner_of_student',
    'animator_of_teacher',
    'coordinator_of_student',
  ])('%s ouvre les archives', (kind) => {
    expect(canRelationsOpenArchives(relation(kind), 'formateur')).toBe(true)
  })

  it.each<RelationKind>([
    'student_of_teacher',
    'student_of_finance_owner',
    'teacher_of_animator',
    'student_of_coordinator',
    'finance_owner_of_student_of_teacher',
    'teacher_of_student_of_finance_owner',
  ])("%s n'ouvre PAS les archives", (kind) => {
    expect(canRelationsOpenArchives(relation(kind), 'eleve')).toBe(false)
  })

  it('un élève ne se voit pas proposer les archives de son formateur', () => {
    expect(canRelationsOpenArchives(relation('student_of_teacher'), 'eleve')).toBe(false)
  })

  it('un parent ne se voit pas proposer les archives du formateur de son élève', () => {
    expect(
      canRelationsOpenArchives(
        relation('finance_owner_of_student_of_teacher'),
        'parent_financeur',
      ),
    ).toBe(false)
  })

  it('aucun lien du tout ne propose rien', () => {
    expect(canRelationsOpenArchives([], 'formateur')).toBe(false)
  })
})

describe('canRelationsOpenArchives — administrateurs', () => {
  it.each(['responsable_pedagogique', 'administrateur_financier', 'technicien_informatique'] as const)(
    '%s accède aux archives de tout le monde, sans lien',
    (role) => {
      expect(canRelationsOpenArchives([], role)).toBe(true)
    },
  )

  it("l'animateur pédagogique n'est PAS un administrateur : sans lien, rien", () => {
    expect(isAdministratorRole('animateur_pedagogique')).toBe(false)
    expect(canRelationsOpenArchives([], 'animateur_pedagogique')).toBe(false)
  })

  it("l'AP accède aux archives du formateur qu'il anime", () => {
    expect(
      canRelationsOpenArchives(relation('animator_of_teacher'), 'animateur_pedagogique'),
    ).toBe(true)
  })
})

describe('describeRelations — libellés français', () => {
  it('traduit chaque nature de lien en français', () => {
    expect(describeRelations(relation('student_of_teacher'))).toEqual(['Mon professeur'])
    expect(describeRelations(relation('animator_of_teacher'))).toEqual([
      "Formateur que j'anime",
    ])
  })

  it('dédoublonne deux liens portant le même libellé', () => {
    expect(
      describeRelations([{ kind: 'teacher_of_student' }, { kind: 'finance_owner_of_student' }]),
    ).toEqual(['Mon élève'])
  })

  it('couvre toutes les natures de lien renvoyées par le serveur', () => {
    const declaredKinds = Object.keys(RELATION_KIND_LABELS)
    expect(declaredKinds).toHaveLength(10)
    declaredKinds.forEach((kind) => {
      expect(RELATION_KIND_LABELS[kind as RelationKind]).toBeTruthy()
    })
  })
})

describe('accès de navigation à /archives', () => {
  it.each([
    'eleve',
    'parent_financeur',
    'formateur',
    'animateur_pedagogique',
    'responsable_pedagogique',
    'administrateur_financier',
    'technicien_informatique',
  ] as const)('%s peut ouvrir /archives', (role) => {
    expect(canAccess(role, '/archives')).toBe(true)
  })

  it("l'AP n'est plus renvoyé sur /forbidden depuis son propre menu", () => {
    // TOP_NAV_CONFIG lui affichait « Stats / Archives » alors que la table d'accès
    // l'excluait : un lien de navigation menait droit à un refus.
    expect(canAccess('animateur_pedagogique', '/archives')).toBe(true)
    expect(canAccess('animateur_pedagogique', '/archives/some-person-id')).toBe(true)
  })
})
