/**
 * RegistrationProgressIndicator — indicateur de progression d'un wizard d'inscription.
 * Extrait de TeacherRegistrationPage / StudentRegistrationPage
 * (lot 10 — normalisation, découpage > 300 lignes). Rendu identique à l'origine.
 */

import React from 'react'

interface RegistrationStep {
  id: string
  label: string
}

interface RegistrationProgressIndicatorProps {
  steps: RegistrationStep[]
  currentStepIndex: number
}

export function RegistrationProgressIndicator({
  steps,
  currentStepIndex,
}: RegistrationProgressIndicatorProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div
            className={`flex items-center gap-1.5 text-xs font-medium ${
              index <= currentStepIndex ? 'text-indigo-600' : 'text-gray-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                index < currentStepIndex
                  ? 'bg-indigo-600 text-white'
                  : index === currentStepIndex
                  ? 'border-2 border-indigo-600 text-indigo-600'
                  : 'border-2 border-gray-300 text-gray-400'
              }`}
            >
              {index < currentStepIndex ? '✓' : index + 1}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 ${
                index < currentStepIndex ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
