/**
 * EmptyState — État vide générique
 *
 * Utilisé quand une liste est vide ou qu'une ressource n'existe pas encore.
 */

import React from 'react'
import { Link } from 'react-router-dom'

interface EmptyStateProps {
  message: string
  actionLabel?: string
  actionPath?: string
  onAction?: () => void
}

export function EmptyState({ message, actionLabel, actionPath, onAction }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: actionLabel ? '14px' : 0 }}>
        {message}
      </p>
      {actionLabel && actionPath && (
        <Link
          to={actionPath}
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#fff',
            background: 'var(--accent)',
            borderRadius: 'var(--radius-pill)',
            padding: '8px 20px',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionPath && (
        <button
          onClick={onAction}
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#fff',
            background: 'var(--accent)',
            borderRadius: 'var(--radius-pill)',
            padding: '8px 20px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
