/**
 * Rail gauche du responsable pédagogique (RP) — reconstruction du 2026-09-02.
 *
 * Vérifie la structure exacte demandée par l'utilisateur
 * (`docs/architecture.md` > « Reconstruction du rail gauche du Responsable
 * Pédagogique (RP) ») : 4 groupes, dans l'ordre — Gestion, À traiter, Contenu,
 * Observabilité — chacun avec ses entrées et son chemin.
 *
 * Vérifie aussi, pour chaque entrée, que `canAccess('responsable_pedagogique',
 * path)` est vrai — règle du projet « Filtrage UI » : aucune entrée de rail ne
 * doit pointer vers une route qui redirigerait le RP vers `/forbidden`.
 *
 * Ne vérifie PAS le contenu des autres rôles en détail (hors périmètre de
 * cette tâche, qui ne touche que le rail RP), seulement qu'ils restent définis
 * et non vides — garde-fou contre une régression accidentelle du fichier
 * partagé `navigationConfig.ts`.
 */

import { describe, it, expect } from 'vitest'
import { RAIL_GROUPS_BY_ROLE, getRailGroupsForRole } from '../src/navigation/navigationConfig'
import { canAccess } from '../src/navigation/navigationFilters'

const RP_ROLE = 'responsable_pedagogique' as const

describe('Rail RP — structure reconstruite (2026-09-02)', () => {
  const groups = getRailGroupsForRole(RP_ROLE)

  it('a exactement 4 groupes, dans l\'ordre Gestion / À traiter / Contenu / Observabilité', () => {
    expect(groups.map((group) => group.groupLabel)).toEqual([
      'Gestion',
      'À traiter',
      'Contenu',
      'Observabilité',
    ])
  })

  it('groupe Gestion : Comptes, Délégations, Visualisation', () => {
    const gestion = groups.find((group) => group.groupLabel === 'Gestion')
    expect(gestion).toBeDefined()
    expect(gestion!.items.map((item) => [item.label, item.path])).toEqual([
      ['Comptes', '/admin/accounts'],
      ['Délégations', '/delegations'],
      ['Visualisation', '/rp/visualisation'],
    ])
  })

  it('groupe À traiter : Nouveaux formateurs, Demandes professeurs, Demandes rattachement, Contenus à valider', () => {
    const aTraiter = groups.find((group) => group.groupLabel === 'À traiter')
    expect(aTraiter).toBeDefined()
    expect(aTraiter!.items.map((item) => [item.label, item.path])).toEqual([
      ['Nouveaux formateurs', '/rp/teacher-validations'],
      ['Demandes professeurs', '/teacher-requests'],
      ['Demandes rattachement', '/parent-link-requests/inbox'],
      ['Contenus à valider', '/content/validation'],
    ])
  })

  // 'Forums' retiré de ce groupe le 2026-09-04 (reconstruction du menu du
  // haut, demande explicite utilisateur) : accessible depuis TOP_NAV_CONFIG
  // (id 'forums'), visible à tous les rôles, plus seulement depuis ce rail.
  it('groupe Contenu : Quizz, Exercices, Évaluations, Tutos/Vidéos, Parcours, Jeux', () => {
    const contenu = groups.find((group) => group.groupLabel === 'Contenu')
    expect(contenu).toBeDefined()
    expect(contenu!.items.map((item) => [item.label, item.path])).toEqual([
      ['Quizz', '/content/quizz'],
      ['Exercices', '/content/exercises'],
      ['Évaluations', '/content/evaluations'],
      ['Tutos/Vidéos', '/content/tutorials'],
      ['Parcours', '/community/paths'],
      ['Jeux', '/community/games'],
    ])
  })

  it('groupe Observabilité : inchangé (Activité globale, Santé services)', () => {
    const observabilite = groups.find((group) => group.groupLabel === 'Observabilité')
    expect(observabilite).toBeDefined()
    expect(observabilite!.items.map((item) => [item.label, item.path])).toEqual([
      ['Activité globale', '/admin/activity'],
      ['Santé services', '/admin/observability/health'],
    ])
  })

  it('chaque entrée du rail RP mène à une route effectivement autorisée pour le RP (jamais /forbidden)', () => {
    const allItems = groups.flatMap((group) => group.items)
    expect(allItems.length).toBeGreaterThan(0)

    for (const item of allItems) {
      expect(
        canAccess(RP_ROLE, item.path),
        `L'entrée « ${item.label} » (${item.path}) ne doit pas être masquée/interdite pour le RP`,
      ).toBe(true)
    }
  })

  it("n'affecte pas les autres rôles : leurs rails restent définis et non vides", () => {
    const otherRoles: Array<keyof typeof RAIL_GROUPS_BY_ROLE> = [
      'eleve',
      'parent_financeur',
      'formateur',
      'animateur_pedagogique',
      'administrateur_financier',
      'technicien_informatique',
    ]

    for (const role of otherRoles) {
      const roleGroups = getRailGroupsForRole(role)
      expect(roleGroups.length, `Le rail du rôle ${role} ne doit pas être vidé`).toBeGreaterThan(0)
      const totalItems = roleGroups.reduce((sum, group) => sum + group.items.length, 0)
      expect(totalItems, `Le rail du rôle ${role} doit conserver des entrées`).toBeGreaterThan(0)
    }
  })
})
