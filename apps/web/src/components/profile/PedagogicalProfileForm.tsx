/**
 * PedagogicalProfileForm — édition de la **section déclarative** du profil
 * pédagogique (`PUT /profiles/:userId/pedagogical`), ce que le titulaire déclare
 * sur lui-même.
 *
 * Deux jeux de champs distincts (docs/routes.md § « Noms de champs des profils ») :
 * - élève : `level`, `schoolName`, `subjects`, `goals`, `difficulties`,
 *   `specificNeeds`, `familyContext`, `schoolContext`, `equipment` ;
 * - formateur : `levels`, `subjects`, `experience`, `diplomas`, `specialties`,
 *   `particularities`, `cvDocumentId`.
 *
 * **Remaniement du 2026-08-11** (demande utilisateur, serveur déjà déployé) :
 * l'unique `context` est séparé en `familyContext` et `schoolContext`, et
 * `schoolName` puis `equipment` sont ajoutés. `context` n'existe plus côté
 * serveur — l'envoyer renvoie `400 property context should not exist` (vérifié
 * contre la pile réelle) : le laisser ici aurait rendu **tout** enregistrement
 * pédagogique élève impossible, ce formulaire renvoyant chacun de ses champs.
 * `equipment` est **un seul champ libre** : la parenthèse de son libellé décrit ce
 * qu'on y met, elle n'annonce pas deux sous-champs.
 *
 * L'ordre d'écran suit `STUDENT_DECLARATIVE_FIELD_NAMES` /
 * `TEACHER_DECLARATIVE_FIELD_NAMES`, seule source d'ordre — un test vérifie que
 * les deux listes coïncident, faute de quoi un champ deviendrait invisible donc
 * impossible à renseigner.
 */

import React from 'react'
import type { DeclarativePedagogicalFields, PedagogicalProfileType } from '../../types/profile'
import { ProfileFieldsForm, type ProfileFieldDescriptor } from './ProfileFieldsForm'

/**
 * Exporté pour être confronté par test à `STUDENT_DECLARATIVE_FIELD_NAMES` :
 * un champ du contrat absent d'ici serait invisible à l'écran, donc impossible à
 * renseigner (défaut constaté sur `passions` le 2026-08-09), et un champ d'ici
 * absent du contrat partirait au serveur pour un `400`.
 */
export const STUDENT_FORM_FIELDS: readonly ProfileFieldDescriptor[] = [
  { name: 'level', placeholder: 'Ex : Terminale, Licence 2, BTS…' },
  { name: 'schoolName', placeholder: 'Ex : lycée des Graves' },
  { name: 'subjects', placeholder: 'Ex : Mathématiques, Physique-Chimie…' },
  { name: 'goals', placeholder: 'Ex : rattraper les lacunes en algèbre, préparer le baccalauréat…', rows: 3 },
  { name: 'difficulties', placeholder: 'Ex : les fonctions dérivées, la rédaction des démonstrations…', rows: 3 },
  { name: 'specificNeeds', placeholder: 'Ex : PAP en cours, tiers-temps aux examens…', rows: 3 },
  { name: 'familyContext', placeholder: 'Ex : une jumelle, parents séparés, garde alternée…', rows: 3 },
  { name: 'schoolContext', placeholder: 'Ex : changement d’établissement en cours d’année, longue absence…', rows: 3 },
  { name: 'equipment', placeholder: 'Ex : chambre au calme, ordinateur portable, webcam, fibre…', rows: 3 },
]

/** Même garde-fou que ci-dessus, côté formateur. */
export const TEACHER_FORM_FIELDS: readonly ProfileFieldDescriptor[] = [
  { name: 'levels', placeholder: 'Ex : Collège, Seconde, Terminale…' },
  { name: 'subjects', placeholder: 'Ex : Mathématiques, Physique-Chimie…' },
  { name: 'experience', placeholder: 'Ex : 8 ans en lycée, préparation aux concours…', rows: 4 },
  { name: 'diplomas', placeholder: 'Ex : agrégation de mathématiques, master MEEF…', rows: 3 },
  { name: 'specialties', placeholder: 'Ex : Préparation Grand Oral, Remise à niveau…' },
  { name: 'particularities', placeholder: 'Ex : accompagnement d’élèves DYS, cours en soirée…', rows: 3 },
  { name: 'cvDocumentId', placeholder: 'Référence du CV déposé dans les archives' },
]

interface PedagogicalProfileFormProps {
  pedagogicalType: PedagogicalProfileType
  profile: Record<string, unknown> | null
  isSaving: boolean
  onSubmit: (payload: DeclarativePedagogicalFields) => void
  /** Omis, aucun bouton « Annuler » n'est proposé (édition en place sur la fiche). */
  onCancel?: () => void
  /** Habillage du `<form>` — la fiche fournit déjà sa carte, l'écran dédié non. */
  className?: string
}

export function PedagogicalProfileForm({
  pedagogicalType,
  profile,
  isSaving,
  onSubmit,
  onCancel,
  className,
}: PedagogicalProfileFormProps) {
  const fields = pedagogicalType === 'teacher' ? TEACHER_FORM_FIELDS : STUDENT_FORM_FIELDS

  return (
    <ProfileFieldsForm
      fields={fields}
      source={profile}
      isSaving={isSaving}
      onSubmit={(payload) => onSubmit(payload as DeclarativePedagogicalFields)}
      onCancel={onCancel}
      className={className}
    />
  )
}
