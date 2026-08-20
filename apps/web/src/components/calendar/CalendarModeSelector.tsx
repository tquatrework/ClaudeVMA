import React from 'react'

export type CalendarInteractionMode = 'view' | 'availability' | 'event'

interface CalendarModeSelectorProps {
  mode: CalendarInteractionMode
  onModeChange: (mode: CalendarInteractionMode) => void
}

const MODE_OPTIONS: Array<{ value: CalendarInteractionMode; label: string; hint: string }> = [
  { value: 'availability', label: 'Indiquer une disponibilité', hint: 'Cliquer ou glisser sur une case vide pour ajouter un créneau de disponibilité' },
  { value: 'event', label: 'Créer un événement', hint: 'Cliquer ou glisser sur une case vide pour créer un événement à cet horaire' },
]

/**
 * CalendarModeSelector — sélecteur de mode « en marge » de la grille unifiée (chantier calendrier
 * vue unifiée, point 2 ; révisé point A des corrections du 2026-08-20). Contrôle uniquement ce qui
 * se passe au clic sur une case **vide** de la grille : consultation (état par défaut implicite,
 * aucune création — ce n'est plus un choix affiché, seulement l'absence de mode actif), création
 * de disponibilité, création d'événement. Sans effet sur l'édition des blocs déjà existants
 * (toujours possible, quel que soit le mode) ni sur « Proposer un créneau à quelqu'un d'autre »,
 * qui reste une action séparée (cible le calendrier d'un tiers, pas un clic sur le sien).
 *
 * Les deux boutons restants sont **mutuellement exclusifs** : cliquer sur celui déjà actif le
 * désélectionne (retour à la consultation, `mode: 'view'`) ; cliquer sur l'autre bascule
 * directement dessus. Jamais les deux actifs à la fois — logique portée ici plutôt que dupliquée
 * chez l'appelant, qui se contente de fournir `mode`/`onModeChange`.
 */
export default function CalendarModeSelector({ mode, onModeChange }: CalendarModeSelectorProps) {
  const activeOption = MODE_OPTIONS.find((option) => option.value === mode)

  const handleClick = (value: CalendarInteractionMode) => {
    onModeChange(mode === value ? 'view' : value)
  }

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
            onClick={() => handleClick(option.value)}
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
      <p className="text-xs text-gray-400 mt-1.5">
        {activeOption ? activeOption.hint : 'Consultation — cliquer sur un créneau pour le consulter ou y répondre'}
      </p>
    </div>
  )
}
