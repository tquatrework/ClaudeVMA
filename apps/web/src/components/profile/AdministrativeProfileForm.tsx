/**
 * AdministrativeProfileForm — édition du profil administratif
 * (`PUT /profiles/:userId/administrative`).
 *
 * Les champs saisis portent les noms EXACTS attendus par profile-service
 * (docs/routes.md § « Noms de champs des profils ») ; leurs libellés viennent du
 * point unique `src/utils/profileFieldLabels.ts`. En particulier l'adresse est
 * découpée en `addressLine1` / `addressLine2` : il n'existe pas de champ
 * `address`, et l'envoyer déclenche un `400`.
 *
 * Les champs chargés mais non éditables ici (`avatarUrl`, `passions`…) sont
 * conservés dans l'état et renvoyés inchangés, pour qu'une modification
 * d'adresse n'efface pas le reste du profil.
 */

import React, { useEffect, useState } from 'react'
import type { AdministrativeProfileFields } from '../../types/profile'
import { isStrictIsoCalendarDate } from '../../utils/dateFormat'
import { getProfileFieldLabel } from '../../utils/profileFieldLabels'
import { ProfileFormActions, ProfileFormField } from './ProfileFormField'

const EDITABLE_FIELDS = [
  { name: 'firstName', type: 'text', placeholder: 'Jean' },
  { name: 'lastName', type: 'text', placeholder: 'Dupont' },
  { name: 'birthDate', type: 'date', placeholder: '' },
  { name: 'phone', type: 'tel', placeholder: '06 12 34 56 78' },
  {
    name: 'addressLine1',
    type: 'text',
    placeholder: '12 rue des Mathématiques',
  },
  {
    name: 'addressLine2',
    type: 'text',
    placeholder: 'Bâtiment B, appartement 24',
    hint: 'Complément facultatif : bâtiment, étage, appartement…',
  },
  { name: 'postalCode', type: 'text', placeholder: '75001' },
  { name: 'city', type: 'text', placeholder: 'Paris' },
  { name: 'country', type: 'text', placeholder: 'France' },
  { name: 'department', type: 'text', placeholder: '75 - Paris' },
] as const satisfies readonly {
  name: keyof AdministrativeProfileFields
  type: 'text' | 'tel' | 'date'
  placeholder: string
  hint?: string
}[]

const INVALID_BIRTH_DATE_MESSAGE =
  'La date de naissance saisie n’est pas une date valide (jour, mois, année)'

interface AdministrativeProfileFormProps {
  profile: AdministrativeProfileFields
  isSaving: boolean
  onSubmit: (payload: AdministrativeProfileFields) => void
  onCancel: () => void
}

export function AdministrativeProfileForm({
  profile,
  isSaving,
  onSubmit,
  onCancel,
}: AdministrativeProfileFormProps) {
  const [values, setValues] = useState<AdministrativeProfileFields>(profile)
  const [birthDateError, setBirthDateError] = useState<string | null>(null)

  useEffect(() => {
    setValues(profile)
    setBirthDateError(null)
  }, [profile])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    // Le serveur exige une date calendaire ISO réellement existante : on refuse
    // ici pour afficher un message en français plutôt qu'un 400 opaque.
    if (values.birthDate && !isStrictIsoCalendarDate(values.birthDate)) {
      setBirthDateError(INVALID_BIRTH_DATE_MESSAGE)
      return
    }

    setBirthDateError(null)
    onSubmit(values)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-white border border-gray-200 rounded-xl p-6"
    >
      {EDITABLE_FIELDS.map((field) => (
        <ProfileFormField
          key={field.name}
          label={getProfileFieldLabel(field.name)}
          type={field.type}
          placeholder={field.placeholder || undefined}
          hint={'hint' in field ? field.hint : undefined}
          value={(values[field.name] as string | undefined) ?? ''}
          onChange={(value) => setValues((previous) => ({ ...previous, [field.name]: value }))}
        />
      ))}

      {birthDateError && (
        <p className="text-sm text-red-600" role="alert">
          {birthDateError}
        </p>
      )}

      <ProfileFormActions isSaving={isSaving} onCancel={onCancel} />
    </form>
  )
}
