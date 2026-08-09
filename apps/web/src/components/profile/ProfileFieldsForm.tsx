/**
 * ProfileFieldsForm — canevas commun des formulaires de profil pilotés par une
 * liste de champs.
 *
 * Trois formulaires partagent exactement la même mécanique (profil pédagogique
 * élève, profil pédagogique formateur, prescription du RP) : lire un bloc plat,
 * afficher un champ par nom, reconvertir les listes à la soumission. Les écrire
 * trois fois ferait diverger les libellés et les conversions.
 *
 * Les libellés et précisions viennent du point unique
 * `src/utils/profileFieldLabels.ts` ; la nature « liste » d'un champ vient de
 * `src/utils/profileFields.ts`. Ce composant ne décide de rien : il rend.
 */

import React, { useEffect, useState } from 'react'
import {
  formatCommaSeparatedList,
  isListField,
  parseCommaSeparatedList,
} from '../../utils/profileFields'
import { getProfileFieldHint, getProfileFieldLabel } from '../../utils/profileFieldLabels'
import { ProfileFormActions, ProfileFormField } from './ProfileFormField'

const LIST_HINT = 'Séparez les valeurs par une virgule'

const FORM_CLASS = 'space-y-4 bg-white border border-gray-200 rounded-xl p-6'

/** Métadonnées de saisie d'un champ. Le libellé n'y figure pas : il est centralisé. */
export interface ProfileFieldDescriptor {
  name: string
  placeholder?: string
  /** Rend un `<textarea>` de `rows` lignes plutôt qu'un `<input>`. */
  rows?: number
}

interface ProfileFieldsFormProps {
  fields: readonly ProfileFieldDescriptor[]
  /** Bloc source (plat) d'où sont lues les valeurs initiales. */
  source: Record<string, unknown> | null
  isSaving: boolean
  onSubmit: (payload: Record<string, unknown>) => void
  /** Omis, aucun bouton « Annuler » n'est proposé (édition en place sur la fiche). */
  onCancel?: () => void
  /** Habillage du `<form>` — la fiche fournit déjà sa carte, l'écran dédié non. */
  className?: string
  /** Contenu libre inséré avant les champs (avertissement de droits, rappel…). */
  children?: React.ReactNode
}

function readInitialValue(source: Record<string, unknown> | null, fieldName: string): string {
  if (isListField(fieldName)) return formatCommaSeparatedList(source?.[fieldName])
  const value = source?.[fieldName]
  return typeof value === 'string' ? value : ''
}

function buildInitialValues(
  fields: readonly ProfileFieldDescriptor[],
  source: Record<string, unknown> | null,
): Record<string, string> {
  const initialValues: Record<string, string> = {}
  for (const field of fields) {
    initialValues[field.name] = readInitialValue(source, field.name)
  }
  return initialValues
}

export function ProfileFieldsForm({
  fields,
  source,
  isSaving,
  onSubmit,
  onCancel,
  className = FORM_CLASS,
  children,
}: ProfileFieldsFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildInitialValues(fields, source),
  )

  useEffect(() => {
    setValues(buildInitialValues(fields, source))
  }, [fields, source])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const payload: Record<string, unknown> = {}
    for (const field of fields) {
      const rawValue = values[field.name] ?? ''
      payload[field.name] = isListField(field.name)
        ? parseCommaSeparatedList(rawValue)
        : rawValue
    }
    onSubmit(payload)
  }

  const updateField = (fieldName: string) => (value: string) =>
    setValues((previous) => ({ ...previous, [fieldName]: value }))

  return (
    <form onSubmit={handleSubmit} className={className}>
      {children}
      {fields.map((field) => (
        <ProfileFormField
          key={field.name}
          label={getProfileFieldLabel(field.name)}
          value={values[field.name] ?? ''}
          onChange={updateField(field.name)}
          placeholder={field.placeholder}
          rows={field.rows}
          hint={isListField(field.name) ? LIST_HINT : getProfileFieldHint(field.name)}
        />
      ))}
      <ProfileFormActions isSaving={isSaving} onCancel={onCancel} />
    </form>
  )
}
