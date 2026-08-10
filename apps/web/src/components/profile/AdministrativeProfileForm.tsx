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
 * Le formulaire propose **les 11 champs du contrat**, ni plus ni moins : la
 * liste `EDITABLE_FIELDS` est vérifiée par test contre
 * `ADMINISTRATIVE_FIELD_NAMES`. Elle en exposait 10 jusqu'au 2026-08-09 —
 * `avatarUrl` et `passions` étaient chargés, conservés et renvoyés, mais
 * introuvables à l'écran, donc impossibles à renseigner.
 *
 * `avatarUrl` en est ressorti le 2026-08-10, dans l'autre sens : la photo est
 * devenue un fichier envoyé par ses propres routes, et le serveur répond
 * désormais `400` si ce champ arrive dans le corps du `PUT`. Le formulaire le
 * renvoyait à chaque enregistrement dès qu'une photo existait — il aurait donc
 * rendu tout profil illustré impossible à modifier. La photo se change dans
 * `ProfileAvatarField`, en tête du même onglet.
 *
 * Un champ laissé vide n'est **pas envoyé** : le serveur refuse une chaîne vide
 * sur `firstName`, `lastName` et `phone` (`400`), et l'absence d'un champ vaut
 * « ne rien changer ». Un formulaire pré-rempli de champs vides ne doit pas
 * transformer une consultation en refus serveur.
 */

import React, { useEffect, useState } from 'react'
import type { AdministrativeProfileFields } from '../../types/profile'
import { isStrictIsoCalendarDate } from '../../utils/dateFormat'
import { getProfileFieldLabel } from '../../utils/profileFieldLabels'
import {
  ADMINISTRATIVE_FIELD_NAMES,
  formatCommaSeparatedList,
  isListField,
  parseCommaSeparatedList,
} from '../../utils/profileFields'
import { ProfileFormActions, ProfileFormField } from './ProfileFormField'

const LIST_HINT = 'Séparez les valeurs par une virgule'

export const EDITABLE_FIELDS = [
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
  {
    name: 'passions',
    type: 'text',
    placeholder: 'Échecs, randonnée, piano…',
  },
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
  /** Omis, aucun bouton « Annuler » n'est proposé (édition en place sur la fiche). */
  onCancel?: () => void
  /** Habillage du `<form>` — la fiche fournit déjà sa carte, l'écran dédié non. */
  className?: string
}

const STANDALONE_FORM_CLASS = 'space-y-4 bg-white border border-gray-200 rounded-xl p-6'

/** Valeurs de saisie : tout est texte, y compris les listes séparées par virgule. */
function buildInitialValues(profile: AdministrativeProfileFields): Record<string, string> {
  const initialValues: Record<string, string> = {}
  for (const fieldName of ADMINISTRATIVE_FIELD_NAMES) {
    const rawValue = profile[fieldName]
    initialValues[fieldName] = isListField(fieldName)
      ? formatCommaSeparatedList(rawValue)
      : typeof rawValue === 'string'
        ? rawValue
        : ''
  }
  return initialValues
}

/**
 * Corps du `PUT` : les champs renseignés seulement.
 *
 * Les champs chargés mais laissés tels quels repartent inchangés, pour qu'une
 * modification d'adresse n'efface pas le reste du profil.
 */
function buildPayload(values: Record<string, string>): AdministrativeProfileFields {
  const payload: Record<string, unknown> = {}
  for (const fieldName of ADMINISTRATIVE_FIELD_NAMES) {
    const rawValue = (values[fieldName] ?? '').trim()
    if (rawValue === '') continue
    payload[fieldName] = isListField(fieldName) ? parseCommaSeparatedList(rawValue) : rawValue
  }
  return payload as AdministrativeProfileFields
}

export function AdministrativeProfileForm({
  profile,
  isSaving,
  onSubmit,
  onCancel,
  className = STANDALONE_FORM_CLASS,
}: AdministrativeProfileFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => buildInitialValues(profile))
  const [birthDateError, setBirthDateError] = useState<string | null>(null)

  useEffect(() => {
    setValues(buildInitialValues(profile))
    setBirthDateError(null)
  }, [profile])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    // Le serveur exige une date calendaire ISO réellement existante : on refuse
    // ici pour afficher un message en français plutôt qu'un 400 opaque.
    const birthDate = values.birthDate?.trim()
    if (birthDate && !isStrictIsoCalendarDate(birthDate)) {
      setBirthDateError(INVALID_BIRTH_DATE_MESSAGE)
      return
    }

    setBirthDateError(null)
    onSubmit(buildPayload(values))
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      {EDITABLE_FIELDS.map((field) => (
        <ProfileFormField
          key={field.name}
          label={getProfileFieldLabel(field.name)}
          type={field.type}
          placeholder={field.placeholder || undefined}
          hint={isListField(field.name) ? LIST_HINT : 'hint' in field ? field.hint : undefined}
          value={values[field.name] ?? ''}
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
