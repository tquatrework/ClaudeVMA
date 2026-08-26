/**
 * ResourceLinkEditor — ajout/retrait de liens externes (`resourceLinks`) sur
 * une entrée de cahier de texte. Partagé entre `NewLogPageForm` (création) et
 * `PedagogicalLogEntryItem` (édition) : même champ, mêmes règles d'écriture
 * (formateur auteur uniquement), donc un seul composant.
 *
 * Présentationnel : le tableau de liens reste porté par l'appelant.
 */

import React from 'react'
import type { ResourceLink } from '../../api/pedagogicalLog'
import { MAX_RESOURCE_LINKS } from '../../utils/resourceLinks'

interface ResourceLinkEditorProps {
  links: ResourceLink[]
  onChange: (links: ResourceLink[]) => void
  /** Préfixe d'id unique par instance (création vs édition d'une entrée précise). */
  idPrefix: string
}

export function ResourceLinkEditor({ links, onChange, idPrefix }: ResourceLinkEditorProps) {
  const handleAddLink = () => {
    onChange([...links, { label: '', url: '' }])
  }

  const handleRemoveLink = (index: number) => {
    onChange(links.filter((_, linkIndex) => linkIndex !== index))
  }

  const handleFieldChange = (index: number, field: keyof ResourceLink, value: string) => {
    onChange(links.map((link, linkIndex) => (linkIndex === index ? { ...link, [field]: value } : link)))
  }

  return (
    <div>
      <p className="block text-xs text-gray-500 mb-1">Liens vers une ressource</p>

      {links.length > 0 && (
        <ul className="space-y-2 mb-2">
          {links.map((link, index) => (
            <li key={index} className="flex flex-col gap-1 rounded-lg border border-gray-200 p-2 sm:flex-row sm:items-center">
              <input
                id={`${idPrefix}-resource-link-label-${index}`}
                type="text"
                value={link.label}
                onChange={(event) => handleFieldChange(index, 'label', event.target.value)}
                placeholder="Texte affiché (ex. Fiche de cours)"
                aria-label="Texte affiché du lien"
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <input
                id={`${idPrefix}-resource-link-url-${index}`}
                type="url"
                value={link.url}
                onChange={(event) => handleFieldChange(index, 'url', event.target.value)}
                placeholder="https://…"
                aria-label="Adresse (URL) du lien"
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="button"
                onClick={() => handleRemoveLink(index)}
                className="text-xs text-red-400 hover:underline shrink-0"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={handleAddLink}
        disabled={links.length >= MAX_RESOURCE_LINKS}
        className="text-xs text-indigo-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
      >
        + Ajouter un lien
      </button>
    </div>
  )
}
