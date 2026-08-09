/**
 * ProfileFormField — champ de saisie labellisé, partagé par les formulaires de
 * profil (administratif et pédagogique, élève comme formateur).
 *
 * Extrait pour que l'ajout ou le renommage d'un champ de profil se limite à une
 * ligne de déclaration, sans recopier le balisage ni les classes.
 */

import React, { useId } from 'react'

const INPUT_CLASS =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'

interface ProfileFormFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'tel' | 'date'
  placeholder?: string
  /** Rend un `<textarea>` de `rows` lignes au lieu d'un `<input>`. */
  rows?: number
  /** Précision affichée sous le champ (ex : format de saisie attendu). */
  hint?: string
}

export function ProfileFormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  rows,
  hint,
}: ProfileFormFieldProps) {
  // Label explicitement associé au champ : accessibilité, et indispensable pour
  // que les tests ciblent un champ par son libellé plutôt que par son placeholder.
  const fieldId = useId()

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {rows ? (
        <textarea
          id={fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={`${INPUT_CLASS} resize-none`}
        />
      ) : (
        <input
          id={fieldId}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={INPUT_CLASS}
        />
      )}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

interface ProfileFormActionsProps {
  isSaving: boolean
  /**
   * Omis, aucun bouton « Annuler » n'est rendu : sur la fiche, le formulaire est
   * la vue elle-même — il n'y a nulle part où revenir, et un bouton sans
   * destination serait un piège.
   */
  onCancel?: () => void
}

/** Barre d'actions commune aux formulaires de profil. */
export function ProfileFormActions({ isSaving, onCancel }: ProfileFormActionsProps) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="submit"
        disabled={isSaving}
        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
      >
        {isSaving ? 'Sauvegarde…' : 'Enregistrer'}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 text-sm"
        >
          Annuler
        </button>
      )}
    </div>
  )
}
