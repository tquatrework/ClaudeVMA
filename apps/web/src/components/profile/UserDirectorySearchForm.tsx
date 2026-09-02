/**
 * UserDirectorySearchForm — recherche par nom sur un onglet de l'écran « Visualisation »
 * du rail RP (`RpUserDirectoryPage`). Soumission explicite (un champ + un bouton), même
 * convention que `MemoSearch` : pas de requête à chaque frappe.
 *
 * `draftValue` est l'état de saisie local, distinct de la valeur réellement soumise
 * (`onSubmit`) — la recherche côté serveur (`GET /profiles/directory/by-role?...&q=`,
 * `docs/routes.md`, complément 2026-09-02) ne part qu'à la validation.
 */

import React from 'react'

interface UserDirectorySearchFormProps {
  draftValue: string
  onDraftValueChange: (value: string) => void
  onSubmit: () => void
  onReset: () => void
  hasActiveSearch: boolean
  genericLabel: string
}

export function UserDirectorySearchForm({
  draftValue,
  onDraftValueChange,
  onSubmit,
  onReset,
  hasActiveSearch,
  genericLabel,
}: UserDirectorySearchFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="flex gap-2"
    >
      <input
        type="text"
        value={draftValue}
        onChange={(event) => onDraftValueChange(event.target.value)}
        placeholder={`Rechercher un(e) ${genericLabel.toLowerCase()} par nom…`}
        className="flex-1 border border-[var(--color-surface)] rounded-[var(--radius-input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />
      <button
        type="submit"
        className="text-sm text-white bg-[var(--accent)] px-4 py-2 rounded-[var(--radius-pill)] font-medium"
      >
        Rechercher
      </button>
      {hasActiveSearch && (
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-[color:var(--color-text-secondary)] border border-[var(--color-surface)] px-4 py-2 rounded-[var(--radius-pill)] font-medium"
        >
          Réinitialiser
        </button>
      )}
    </form>
  )
}
