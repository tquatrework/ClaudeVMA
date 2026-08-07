/**
 * AdministrativeProfileForm — édition du profil administratif
 * (`PUT /profiles/:userId/administrative`).
 *
 * Les champs saisis portent les noms EXACTS attendus par profile-service
 * (docs/routes.md § « Noms de champs des profils »). En particulier l'adresse est
 * découpée en `addressLine1` / `addressLine2` : il n'existe pas de champ
 * `address`, et l'envoyer déclenche un `400`.
 *
 * Les champs chargés mais non éditables ici (`postalCode`, `city`, `country`,
 * `birthDate`, `department`, `passions`…) sont conservés dans l'état et renvoyés
 * inchangés, pour qu'une modification d'adresse n'efface pas le reste du profil.
 */

import React, { useEffect, useState } from 'react'
import type { AdministrativeProfileFields } from '../../types/profile'
import { ProfileFormActions, ProfileFormField } from './ProfileFormField'

const EDITABLE_FIELDS = [
  { name: 'firstName', label: 'Prénom', type: 'text', placeholder: 'Jean' },
  { name: 'lastName', label: 'Nom', type: 'text', placeholder: 'Dupont' },
  { name: 'phone', label: 'Téléphone', type: 'tel', placeholder: '06 12 34 56 78' },
  {
    name: 'addressLine1',
    label: 'Adresse (ligne 1)',
    type: 'text',
    placeholder: '12 rue des Mathématiques',
  },
  {
    name: 'addressLine2',
    label: 'Adresse (ligne 2)',
    type: 'text',
    placeholder: 'Bâtiment B, appartement 24',
    hint: 'Complément facultatif : bâtiment, étage, appartement…',
  },
] as const satisfies readonly {
  name: keyof AdministrativeProfileFields
  label: string
  type: 'text' | 'tel'
  placeholder: string
  hint?: string
}[]

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

  useEffect(() => {
    setValues(profile)
  }, [profile])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
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
          label={field.label}
          type={field.type}
          placeholder={field.placeholder}
          hint={'hint' in field ? field.hint : undefined}
          value={(values[field.name] as string | undefined) ?? ''}
          onChange={(value) => setValues((previous) => ({ ...previous, [field.name]: value }))}
        />
      ))}

      <ProfileFormActions isSaving={isSaving} onCancel={onCancel} />
    </form>
  )
}
