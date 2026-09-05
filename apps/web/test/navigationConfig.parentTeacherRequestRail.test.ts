/**
 * Rail gauche du parent financeur — ajout de l'entrée « Demande de professeur »
 * (2026-09-05, docs/architecture/contacts-messagerie.md > « Retrait du raccourci
 * "Demande de professeur" de la page Contacts, et ajout de l'entrée de rail
 * correspondante pour les parents »).
 *
 * Vérifie :
 *  1. L'entrée existe dans le groupe « Démarches » du rail parent, juste après
 *     « Demande de rattachement » (positionnement demandé explicitement).
 *  2. Elle pointe vers la route déjà existante `/teacher-requests` (aucun
 *     changement backend, aucune nouvelle route).
 *  3. Elle mène à une route effectivement autorisée pour le parent financeur
 *     (règle du projet « Filtrage UI » : jamais un lien vers /forbidden).
 *  4. Le rail élève, non concerné par ce chantier, garde son entrée existante.
 */

import { describe, it, expect } from 'vitest'
import { getRailGroupsForRole } from '../src/navigation/navigationConfig'
import { canAccess } from '../src/navigation/navigationFilters'

describe('Rail parent — ajout de « Demande de professeur » (2026-09-05)', () => {
  const groups = getRailGroupsForRole('parent_financeur')
  const demarches = groups.find((group) => group.groupLabel === 'Démarches')

  it('le groupe « Démarches » existe et contient « Demande de rattachement » puis « Demande de professeur »', () => {
    expect(demarches).toBeDefined()
    expect(demarches!.items.map((item) => [item.label, item.path])).toEqual([
      ['Demande de rattachement', '/parent-link-requests'],
      ['Demande de professeur', '/teacher-requests'],
    ])
  })

  it("l'entrée « Demande de professeur » mène à une route autorisée pour le parent financeur", () => {
    const item = demarches!.items.find((entry) => entry.label === 'Demande de professeur')
    expect(item).toBeDefined()
    expect(
      canAccess('parent_financeur', item!.path),
      `L'entrée « ${item!.label} » (${item!.path}) ne doit pas être masquée/interdite pour le parent`,
    ).toBe(true)
  })

  it("le rail élève garde son entrée « Demandes professeurs » existante, inchangée", () => {
    const eleveGroups = getRailGroupsForRole('eleve')
    const cours = eleveGroups.find((group) => group.groupLabel === 'Cours')
    expect(cours).toBeDefined()
    const item = cours!.items.find((entry) => entry.path === '/teacher-requests')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Demandes professeurs')
    expect(canAccess('eleve', item!.path)).toBe(true)
  })
})
