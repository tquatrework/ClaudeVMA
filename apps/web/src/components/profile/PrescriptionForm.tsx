/**
 * PrescriptionForm — édition de la **section prescription** du profil pédagogique
 * (`PUT /profiles/:userId/prescription`), réservée au responsable pédagogique.
 *
 * Le formulaire n'est proposé qu'au RP : pour tout autre rôle, y compris le
 * titulaire du profil, le serveur répond `403`. Le front n'en déduit pas de règle
 * de droit propre — il se contente de ne pas afficher une porte fermée (règle de
 * filtrage UI du projet) et de traduire le refus s'il survient malgré tout.
 *
 * `filledBy` et `filledAt` ne sont jamais saisis ni envoyés : le serveur les pose
 * lui-même, c'est ce qui rend la prescription opposable.
 */

import React from 'react'
import type { PedagogicalProfileType, PrescriptionFields } from '../../types/profile'
import { ProfileFieldsForm, type ProfileFieldDescriptor } from './ProfileFieldsForm'

const STUDENT_PRESCRIPTION_FIELDS: readonly ProfileFieldDescriptor[] = [
  { name: 'generalAssessment', placeholder: 'Appréciation générale sur la situation de l’élève', rows: 4 },
  { name: 'recommendedPace', placeholder: 'Ex : deux séances hebdomadaires d’une heure', rows: 2 },
  { name: 'recommendedTeacherProfile', placeholder: 'Ex : formateur habitué aux élèves en reprise de confiance', rows: 2 },
  { name: 'recommendedPath', placeholder: 'Ex : remise à niveau algèbre puis préparation au baccalauréat', rows: 3 },
  { name: 'recommendedActivities', placeholder: 'Ex : exercices guidés hebdomadaires, évaluation mensuelle', rows: 3 },
]

const TEACHER_PRESCRIPTION_FIELDS: readonly ProfileFieldDescriptor[] = [
  { name: 'maxValidatedLevel', placeholder: 'Ex : Terminale spécialité mathématiques' },
  { name: 'audienceType', placeholder: 'Ex : collège et lycée, élèves à besoins particuliers', rows: 2 },
  { name: 'testResults', placeholder: 'Résultats du test de positionnement', rows: 3 },
  { name: 'testComments', placeholder: 'Commentaires sur le déroulé et les points de vigilance', rows: 4 },
]

interface PrescriptionFormProps {
  pedagogicalType: PedagogicalProfileType
  profile: Record<string, unknown> | null
  isSaving: boolean
  onSubmit: (payload: PrescriptionFields) => void
  onCancel: () => void
}

export function PrescriptionForm({
  pedagogicalType,
  profile,
  isSaving,
  onSubmit,
  onCancel,
}: PrescriptionFormProps) {
  const fields =
    pedagogicalType === 'teacher' ? TEACHER_PRESCRIPTION_FIELDS : STUDENT_PRESCRIPTION_FIELDS

  return (
    <ProfileFieldsForm
      fields={fields}
      source={profile}
      isSaving={isSaving}
      onSubmit={(payload) => onSubmit(payload as PrescriptionFields)}
      onCancel={onCancel}
    >
      <p className="text-sm text-gray-500 border-l-4 border-l-indigo-400 pl-3">
        Ces préconisations sont rédigées <strong>sur</strong> la personne concernée, qui pourra les
        lire sans pouvoir les modifier. Votre nom et la date d'écriture y sont attachés.
      </p>
    </ProfileFieldsForm>
  )
}
