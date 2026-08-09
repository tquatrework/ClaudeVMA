/**
 * PedagogicalProfileForm — édition de la **section déclarative** du profil
 * pédagogique (`PUT /profiles/:userId/pedagogical`), ce que le titulaire déclare
 * sur lui-même.
 *
 * Deux jeux de champs distincts (docs/routes.md § « Noms de champs des profils ») :
 * - élève : `level`, `subjects`, `goals`, `specificNeeds`, `difficulties`, `context` ;
 * - formateur : `levels`, `subjects`, `experience`, `diplomas`, `specialties`,
 *   `particularities`, `cvDocumentId`.
 *
 * Aucun champ de prescription n'y figure : le serveur les refuse en `400` sur
 * cette route, et c'est voulu — un élève ne rédige pas ses préconisations, un
 * formateur pas ses résultats de test. Ils s'éditent par `PrescriptionForm`.
 *
 * La forme éditée vient de `pedagogicalType` renvoyé par le serveur : le front ne
 * la déduit plus des champs présents.
 */

import React from 'react'
import type { DeclarativePedagogicalFields, PedagogicalProfileType } from '../../types/profile'
import { ProfileFieldsForm, type ProfileFieldDescriptor } from './ProfileFieldsForm'

const STUDENT_FIELDS: readonly ProfileFieldDescriptor[] = [
  { name: 'level', placeholder: 'Ex : Terminale, Licence 2, BTS…' },
  { name: 'subjects', placeholder: 'Ex : Mathématiques, Physique-Chimie…' },
  { name: 'goals', placeholder: 'Ex : rattraper les lacunes en algèbre, préparer le baccalauréat…', rows: 3 },
  { name: 'difficulties', placeholder: 'Ex : les fonctions dérivées, la rédaction des démonstrations…', rows: 3 },
  { name: 'specificNeeds', placeholder: 'Ex : PAP en cours, tiers-temps aux examens…', rows: 3 },
  { name: 'context', placeholder: 'Ex : changement d’établissement en cours d’année, longue absence…', rows: 3 },
]

const TEACHER_FIELDS: readonly ProfileFieldDescriptor[] = [
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
  onCancel: () => void
}

export function PedagogicalProfileForm({
  pedagogicalType,
  profile,
  isSaving,
  onSubmit,
  onCancel,
}: PedagogicalProfileFormProps) {
  const fields = pedagogicalType === 'teacher' ? TEACHER_FIELDS : STUDENT_FIELDS

  return (
    <ProfileFieldsForm
      fields={fields}
      source={profile}
      isSaving={isSaving}
      onSubmit={(payload) => onSubmit(payload as DeclarativePedagogicalFields)}
      onCancel={onCancel}
    />
  )
}
