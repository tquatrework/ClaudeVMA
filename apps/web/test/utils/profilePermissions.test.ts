/**
 * Tests des droits d'écriture sur un profil — point unique partagé par la fiche
 * et l'écran de modification.
 *
 * Enjeu : la fiche affiche désormais des champs saisissables. Ouvrir un
 * formulaire à qui n'a pas le droit d'écrire produirait un `403` au moment
 * d'enregistrer, après la frappe — le pire moment pour l'apprendre.
 *
 * Règles vérifiées (`docs/architecture.md` § « Arbitrages rendus », 2026-08-07
 * et 2026-08-09) :
 * - le titulaire écrit son profil ;
 * - RP et TI écrivent celui des autres, chacun dans son domaine ;
 * - le parent financeur **lit tout et n'écrit rien** ;
 * - la prescription reste au RP seul, y compris sur son propre profil.
 */

import { describe, it, expect } from 'vitest'
import {
  canEditAdministrativeProfile,
  canEditDeclarativePedagogicalProfile,
  canEditPrescription,
  roleHasPedagogicalProfile,
} from '../../src/utils/profilePermissions'

describe('canEditAdministrativeProfile', () => {
  it('autorise le titulaire, quel que soit son rôle', () => {
    expect(canEditAdministrativeProfile('eleve', true)).toBe(true)
    expect(canEditAdministrativeProfile('formateur', true)).toBe(true)
    expect(canEditAdministrativeProfile('parent_financeur', true)).toBe(true)
  })

  it('autorise le responsable pédagogique et le technicien informatique sur un tiers', () => {
    expect(canEditAdministrativeProfile('responsable_pedagogique', false)).toBe(true)
    expect(canEditAdministrativeProfile('technicien_informatique', false)).toBe(true)
  })

  it("refuse au parent financeur d'écrire le profil de son enfant", () => {
    // Il voit tout, il ne modifie rien : il passe par l'élève ou par un RP.
    expect(canEditAdministrativeProfile('parent_financeur', false)).toBe(false)
  })

  it('refuse au formateur d’écrire le profil de son élève', () => {
    // Un lien de relation ouvre la lecture, jamais l'écriture.
    expect(canEditAdministrativeProfile('formateur', false)).toBe(false)
  })

  it('refuse un rôle inconnu', () => {
    expect(canEditAdministrativeProfile(undefined, false)).toBe(false)
  })
})

describe('canEditDeclarativePedagogicalProfile', () => {
  it('autorise le titulaire élève ou formateur sur son propre profil', () => {
    expect(canEditDeclarativePedagogicalProfile('eleve', true)).toBe(true)
    expect(canEditDeclarativePedagogicalProfile('formateur', true)).toBe(true)
    expect(canEditDeclarativePedagogicalProfile('animateur_pedagogique', true)).toBe(true)
  })

  it("refuse au parent financeur, qui n'a pas de profil pédagogique", () => {
    expect(canEditDeclarativePedagogicalProfile('parent_financeur', true)).toBe(false)
    expect(canEditDeclarativePedagogicalProfile('parent_financeur', false)).toBe(false)
  })

  it('autorise le RP sur un tiers, jamais sur lui-même', () => {
    expect(canEditDeclarativePedagogicalProfile('responsable_pedagogique', false)).toBe(true)
    expect(canEditDeclarativePedagogicalProfile('responsable_pedagogique', true)).toBe(false)
  })

  it('autorise le technicien informatique', () => {
    expect(canEditDeclarativePedagogicalProfile('technicien_informatique', false)).toBe(true)
  })

  it('refuse au formateur d’écrire le profil pédagogique de son élève', () => {
    expect(canEditDeclarativePedagogicalProfile('formateur', false)).toBe(false)
  })
})

describe('canEditPrescription', () => {
  it('est réservée au responsable pédagogique', () => {
    expect(canEditPrescription('responsable_pedagogique')).toBe(true)
  })

  it('est refusée au titulaire : il la lit, il ne la rédige pas', () => {
    expect(canEditPrescription('eleve')).toBe(false)
    expect(canEditPrescription('formateur')).toBe(false)
    expect(canEditPrescription('technicien_informatique')).toBe(false)
  })
})

describe('roleHasPedagogicalProfile', () => {
  it('reconnaît les rôles qui en ont un', () => {
    expect(roleHasPedagogicalProfile('eleve')).toBe(true)
    expect(roleHasPedagogicalProfile('formateur')).toBe(true)
    expect(roleHasPedagogicalProfile('animateur_pedagogique')).toBe(true)
  })

  it("n'en attribue pas au parent financeur ni aux rôles administratifs", () => {
    expect(roleHasPedagogicalProfile('parent_financeur')).toBe(false)
    expect(roleHasPedagogicalProfile('responsable_pedagogique')).toBe(false)
    expect(roleHasPedagogicalProfile('administrateur_financier')).toBe(false)
    expect(roleHasPedagogicalProfile(undefined)).toBe(false)
  })
})
