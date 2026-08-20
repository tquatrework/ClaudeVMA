import React from 'react'

export type CalendarInteractionMode = 'view' | 'availability' | 'event'

interface CalendarModeSelectorProps {
  mode: CalendarInteractionMode
  onModeChange: (mode: CalendarInteractionMode) => void
}

const MODE_OPTIONS: Array<{ value: CalendarInteractionMode; label: string; hint: string }> = [
  { value: 'view', label: 'Consultation', hint: 'Cliquer sur un créneau pour le consulter ou y répondre' },
  { value: 'availability', label: 'Créer une disponibilité', hint: 'Cliquer sur une case vide pour ajouter un créneau de disponibilité' },
  { value: 'event', label: 'Créer un événement', hint: 'Cliquer sur une case vide pour créer un événement à cet horaire' },
]

/**
 * CalendarModeSelector — sélecteur de mode « en marge » de la grille unifiée (chantier calendrier
 * vue unifiée, point 2). Contrôle uniquement ce qui se passe au clic sur une case **vide** de la
 * grille : consultation (défaut, aucune création), création de disponibilité, création
 * d'événement. Sans effet sur l'édition des blocs déjà existants (toujours possible, quel que
 * soit le mode) ni sur « Proposer un créneau à quelqu'un d'autre », qui reste une action séparée
 * (cible le calendrier d'un tiers, pas un clic sur le sien).
 */
export default function CalendarModeSelector({ mode, onModeChange }: CalendarModeSelectorProps) {
  const activeOption = MODE_OPTIONS.find((option) => option.value === mode)

  return (
    <div className="mb-4">
      <div
        role="tablist"
        aria-label="Mode d'interaction avec le calendrier"
        className="inline-flex border border-gray-200 rounded-lg overflow-hidden"
      >
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={mode === option.value}
            onClick={() => onModeChange(option.value)}
            className={`px-3 py-2 text-sm border-l first:border-l-0 border-gray-200 ${
              mode === option.value
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {activeOption && <p className="text-xs text-gray-400 mt-1.5">{activeOption.hint}</p>}
    </div>
  )
}
