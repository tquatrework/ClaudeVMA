/**
 * ErrorMessage — Bloc d'erreur formaté
 *
 * Remplace les divs d-erreur inline dupliquées dans toutes les pages.
 * Pattern : p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm
 */

import React from 'react'

interface ErrorMessageProps {
  /** Message d'erreur à afficher */
  message: string
  /** Callback de fermeture (optionnel — affiche un bouton ✕) */
  onClose?: () => void
  /** Variante visuelle */
  variant?: 'error' | 'warning' | 'success'
  className?: string
}

const VARIANT_CLASSES = {
  error: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  success: 'bg-green-50 border-green-200 text-green-700',
}

export function ErrorMessage({
  message,
  onClose,
  variant = 'error',
  className = '',
}: ErrorMessageProps) {
  return (
    <div
      className={`p-4 border rounded-xl text-sm flex items-center justify-between gap-3 ${VARIANT_CLASSES[variant]} ${className}`}
    >
      <span>{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Fermer"
        >
          ✕
        </button>
      )}
    </div>
  )
}
