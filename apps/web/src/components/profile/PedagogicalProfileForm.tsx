/**
 * PedagogicalProfileForm — édition du profil pédagogique
 * (`PUT /profiles/:userId/pedagogical`).
 *
 * Deux formes distinctes selon la personne éditée (docs/routes.md § « Noms de
 * champs des profils ») :
 * - élève : `level`, `goals`, `specificNeeds`, `subjects` ;
 * - formateur : `levels` (pluriel, tableau), `experience`, `testResults`, `subjects`.
 *
 * Le serveur choisit la table cible d'après les champs reçus : envoyer `level`
 * pour un formateur créerait un profil ÉLÈVE à son nom. Le formulaire n'envoie
 * donc jamais que les champs de la forme résolue.
 *
 * `subjects` et `levels` sont des `string[]` côté API : la saisie reste du texte
 * séparé par des virgules, converti à la frontière API.
 */

import React, { useEffect, useState } from 'react'
import type {
  PedagogicalProfileFields,
  StudentPedagogicalFormValues,
  TeacherPedagogicalFormValues,
} from '../../types/profile'
import {
  formatCommaSeparatedList,
  parseCommaSeparatedList,
} from '../../utils/profileFields'
import { ProfileFormActions, ProfileFormField } from './ProfileFormField'

const LIST_HINT = 'Séparez les valeurs par une virgule'

const FORM_CLASS = 'space-y-4 bg-white border border-gray-200 rounded-xl p-6'

function readText(source: Record<string, unknown> | null, fieldName: string): string {
  const value = source?.[fieldName]
  return typeof value === 'string' ? value : ''
}

// ─── Formulaire élève ─────────────────────────────────────────────────────────

interface StudentFormProps {
  profile: Record<string, unknown> | null
  isSaving: boolean
  onSubmit: (payload: PedagogicalProfileFields) => void
  onCancel: () => void
}

function StudentPedagogicalForm({ profile, isSaving, onSubmit, onCancel }: StudentFormProps) {
  const [values, setValues] = useState<StudentPedagogicalFormValues>({
    level: '',
    subjects: '',
    goals: '',
    specificNeeds: '',
  })

  useEffect(() => {
    setValues({
      level: readText(profile, 'level'),
      subjects: formatCommaSeparatedList(profile?.subjects),
      goals: readText(profile, 'goals'),
      specificNeeds: readText(profile, 'specificNeeds'),
    })
  }, [profile])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSubmit({
      level: values.level,
      goals: values.goals,
      specificNeeds: values.specificNeeds,
      subjects: parseCommaSeparatedList(values.subjects),
    })
  }

  const updateField = (field: keyof StudentPedagogicalFormValues) => (value: string) =>
    setValues((previous) => ({ ...previous, [field]: value }))

  return (
    <form onSubmit={handleSubmit} className={FORM_CLASS}>
      <ProfileFormField
        label="Niveau scolaire"
        value={values.level}
        onChange={updateField('level')}
        placeholder="Ex : Terminale, Licence 2, BTS…"
      />
      <ProfileFormField
        label="Matières concernées"
        value={values.subjects}
        onChange={updateField('subjects')}
        placeholder="Ex : Mathématiques, Physique-Chimie…"
        hint={LIST_HINT}
      />
      <ProfileFormField
        label="Objectifs pédagogiques"
        value={values.goals}
        onChange={updateField('goals')}
        placeholder="Ex : Rattraper les lacunes en algèbre, préparer le baccalauréat…"
        rows={3}
      />
      <ProfileFormField
        label="Besoins spécifiques"
        value={values.specificNeeds}
        onChange={updateField('specificNeeds')}
        placeholder="Ex : aménagements, difficultés de lecture, rythme adapté…"
        rows={3}
        hint="Besoins d'apprentissage particuliers à signaler au formateur"
      />
      <ProfileFormActions isSaving={isSaving} onCancel={onCancel} />
    </form>
  )
}

// ─── Formulaire formateur ─────────────────────────────────────────────────────

function TeacherPedagogicalForm({ profile, isSaving, onSubmit, onCancel }: StudentFormProps) {
  const [values, setValues] = useState<TeacherPedagogicalFormValues>({
    levels: '',
    subjects: '',
    experience: '',
    testResults: '',
  })

  useEffect(() => {
    setValues({
      levels: formatCommaSeparatedList(profile?.levels),
      subjects: formatCommaSeparatedList(profile?.subjects),
      experience: readText(profile, 'experience'),
      testResults: readText(profile, 'testResults'),
    })
  }, [profile])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSubmit({
      levels: parseCommaSeparatedList(values.levels),
      subjects: parseCommaSeparatedList(values.subjects),
      experience: values.experience,
      testResults: values.testResults,
    })
  }

  const updateField = (field: keyof TeacherPedagogicalFormValues) => (value: string) =>
    setValues((previous) => ({ ...previous, [field]: value }))

  return (
    <form onSubmit={handleSubmit} className={FORM_CLASS}>
      <ProfileFormField
        label="Niveaux enseignés"
        value={values.levels}
        onChange={updateField('levels')}
        placeholder="Ex : Collège, Seconde, Terminale…"
        hint={LIST_HINT}
      />
      <ProfileFormField
        label="Matières enseignées"
        value={values.subjects}
        onChange={updateField('subjects')}
        placeholder="Ex : Mathématiques, Physique-Chimie…"
        hint={LIST_HINT}
      />
      <ProfileFormField
        label="Expérience pédagogique"
        value={values.experience}
        onChange={updateField('experience')}
        placeholder="Ex : 8 ans en lycée, préparation aux concours…"
        rows={4}
      />
      <ProfileFormField
        label="Résultats de tests"
        value={values.testResults}
        onChange={updateField('testResults')}
        placeholder="Ex : test de positionnement VisioMath, certifications…"
        rows={3}
      />
      <ProfileFormActions isSaving={isSaving} onCancel={onCancel} />
    </form>
  )
}

// ─── Aiguillage ───────────────────────────────────────────────────────────────

interface PedagogicalProfileFormProps extends StudentFormProps {
  kind: 'student' | 'teacher'
}

export function PedagogicalProfileForm({ kind, ...formProps }: PedagogicalProfileFormProps) {
  return kind === 'teacher' ? (
    <TeacherPedagogicalForm {...formProps} />
  ) : (
    <StudentPedagogicalForm {...formProps} />
  )
}
