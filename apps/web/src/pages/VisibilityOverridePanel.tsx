/**
 * VisibilityOverridePanel — Phase 15 (admin-observability-service)
 *
 * Gestion des masquages temporaires de ressources (TI uniquement).
 * Un masquage n'efface pas les données, il les rend invisibles temporairement.
 *
 * Routes API consommées :
 *   POST   /admin/visibility-overrides
 *   DELETE /admin/visibility-overrides/:id
 */

import React, { useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  createVisibilityOverride,
  deleteVisibilityOverride,
  type VisibilityOverride,
  type VisibilityOverrideTarget,
  type CreateVisibilityOverridePayload,
} from '../api/adminObservability'
import { getErrorMessage } from '../utils/apiError'
import { VisibilityOverrideList, TARGET_TYPE_LABELS } from '../components/admin/VisibilityOverrideList'

export default function VisibilityOverridePanel() {
  const { hasRole, user } = useAuth()

  const [activeOverrides, setActiveOverrides] = useState<VisibilityOverride[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [shouldShowForm, setShouldShowForm] = useState(false)

  // Formulaire
  const [newTargetType, setNewTargetType] = useState<VisibilityOverrideTarget>('account')
  const [newTargetId, setNewTargetId] = useState('')
  const [newReason, setNewReason] = useState('')
  const [newExpiresAt, setNewExpiresAt] = useState('')

  const isTi = hasRole('technicien_informatique')

  const handleCreateOverride = async (event: React.FormEvent) => {
    event.preventDefault()

    // Le TI ne peut pas auto-autoriser l'accès AF à ses propres ressources
    if (user && newTargetId === user.id && newTargetType === 'account') {
      setCreateError('Vous ne pouvez pas créer un override sur votre propre compte.')
      return
    }

    setIsCreating(true)
    setCreateError(null)

    const payload: CreateVisibilityOverridePayload = {
      targetType: newTargetType,
      targetId: newTargetId.trim(),
      reason: newReason.trim(),
    }
    if (newExpiresAt) {
      payload.expiresAt = newExpiresAt
    }

    try {
      const createdOverride = await createVisibilityOverride(payload)
      setActiveOverrides((previous) => [createdOverride, ...previous])
      setShouldShowForm(false)
      setNewTargetId('')
      setNewReason('')
      setNewExpiresAt('')
      setNewTargetType('account')
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setCreateError('Vous n\'êtes pas autorisé à créer ce masquage.')
      } else if (responseStatus === 409) {
        setCreateError('Un masquage actif existe déjà pour cette ressource.')
      } else {
        setCreateError('Impossible de créer le masquage. Vérifiez les champs et réessayez.')
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteOverride = async (overrideId: string) => {
    setDeleteError(null)
    try {
      await deleteVisibilityOverride(overrideId)
      setActiveOverrides((previous) => previous.filter((override) => override.id !== overrideId))
    } catch (error: unknown) {
      // Non-bloquant : l'item reste dans la liste, l'échec est juste rendu visible.
      setDeleteError(getErrorMessage(error, 'Impossible de lever ce masquage. Réessayez.'))
    }
  }

  if (!isTi) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">
          Accès réservé aux techniciens informatiques.
        </p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Masquages temporaires</h1>
            <p className="text-gray-500 text-sm mt-1">
              Rendre une ressource invisible sans supprimer les données. Réservé au TI.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShouldShowForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
          >
            Nouveau masquage
          </button>
        </div>

        {/* Avertissement */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800 font-medium">Important</p>
          <p className="text-xs text-amber-700 mt-1">
            Un masquage temporaire n'efface pas les données. La ressource reste accessible aux rôles internes autorisés. Toute action est tracée dans l'audit.
          </p>
        </div>

        {/* Formulaire de création */}
        {shouldShowForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Créer un masquage temporaire</h2>

            <form onSubmit={handleCreateOverride} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="override-target-type" className="block text-sm text-gray-700 mb-1">
                    Type de ressource <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="override-target-type"
                    required
                    value={newTargetType}
                    onChange={(e) => setNewTargetType(e.target.value as VisibilityOverrideTarget)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  >
                    {(Object.keys(TARGET_TYPE_LABELS) as VisibilityOverrideTarget[]).map((targetType) => (
                      <option key={targetType} value={targetType}>
                        {TARGET_TYPE_LABELS[targetType]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="override-target-id" className="block text-sm text-gray-700 mb-1">
                    ID de la ressource <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="override-target-id"
                    type="text"
                    required
                    value={newTargetId}
                    onChange={(e) => setNewTargetId(e.target.value)}
                    placeholder="ex: user-abc123"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="override-reason" className="block text-sm text-gray-700 mb-1">
                    Motif <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="override-reason"
                    required
                    rows={2}
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="Raison du masquage temporaire…"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                    disabled={isCreating}
                  />
                </div>

                <div>
                  <label htmlFor="override-expires-at" className="block text-sm text-gray-700 mb-1">
                    Expiration (optionnel)
                  </label>
                  <input
                    id="override-expires-at"
                    type="datetime-local"
                    value={newExpiresAt}
                    onChange={(e) => setNewExpiresAt(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  />
                </div>
              </div>

              {createError && <p className="text-red-600 text-sm">{createError}</p>}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShouldShowForm(false)
                    setCreateError(null)
                  }}
                  disabled={isCreating}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating ? 'Création…' : 'Appliquer le masquage'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste des overrides actifs */}
        {deleteError && <p className="text-red-600 text-sm">{deleteError}</p>}
        <VisibilityOverrideList
          overrideList={activeOverrides}
          onDeleteOverride={handleDeleteOverride}
        />
      </div>
    </Layout>
  )
}
