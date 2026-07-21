import React, { useState } from 'react'
import Layout from '../components/Layout'
import { useDelegations } from '../hooks/communication/useDelegations'
import type { DelegationStatus } from '../api/communication'

const STATUS_LABELS: Record<DelegationStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Rejetée',
  executed: 'Exécutée',
}

const STATUS_COLORS: Record<DelegationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  executed: 'bg-green-100 text-green-700',
}

export default function DelegationsPage() {
  const {
    delegations,
    isLoading: isLoadingDelegations,
    error: loadError,
    createDelegation,
    isCreating,
    createError: createErrorMessage,
    createSuccessMessage,
    resetCreateFeedback,
  } = useDelegations()

  // Create delegation form state
  const [targetAccountId, setTargetAccountId] = useState('')
  const [delegationAction, setDelegationAction] = useState('')
  const [delegationReason, setDelegationReason] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  const handleCreateDelegation = async (e: React.FormEvent) => {
    e.preventDefault()
    const created = await createDelegation({
      targetAccountId,
      action: delegationAction,
      reason: delegationReason,
    })
    if (created) {
      setTargetAccountId('')
      setDelegationAction('')
      setDelegationReason('')
      setShowCreateForm(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Délégations</h1>
            <p className="text-sm text-gray-500 mt-1">
              Demandes d'actions déléguées nécessitant validation
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm)
              resetCreateFeedback()
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {showCreateForm ? 'Annuler' : 'Nouvelle délégation'}
          </button>
        </div>

        {/* Create delegation form */}
        {showCreateForm && (
          <div className="bg-white border border-indigo-200 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Nouvelle demande de délégation</h2>

            {createSuccessMessage && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {createSuccessMessage}
              </div>
            )}
            {createErrorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {createErrorMessage}
              </div>
            )}

            <form onSubmit={handleCreateDelegation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Identifiant du compte cible *
                </label>
                <input
                  type="text"
                  required
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="UUID du compte visé"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action demandée *
                </label>
                <input
                  type="text"
                  required
                  value={delegationAction}
                  onChange={(e) => setDelegationAction(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="ex: suspend_account, change_role, reset_password…"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Justification *
                </label>
                <textarea
                  required
                  value={delegationReason}
                  onChange={(e) => setDelegationReason(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  placeholder="Expliquez pourquoi cette délégation est nécessaire…"
                />
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isCreating ? 'Création…' : 'Soumettre la demande'}
              </button>
            </form>
          </div>
        )}

        {/* Success message after creation (when form is hidden) */}
        {createSuccessMessage && !showCreateForm && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {createSuccessMessage}
          </div>
        )}

        {/* Delegation list */}
        {isLoadingDelegations ? (
          <div className="text-gray-500 text-sm py-8 text-center">Chargement…</div>
        ) : loadError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {loadError}
          </div>
        ) : delegations.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg font-medium">Aucune délégation</p>
            <p className="text-sm mt-1">Les demandes de délégation apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {delegations.map((delegation) => (
              <div
                key={delegation.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm truncate">
                        {delegation.action}
                      </span>
                      <span
                        className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                          STATUS_COLORS[delegation.status]
                        }`}
                      >
                        {STATUS_LABELS[delegation.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">
                      Compte cible : <span className="font-mono">{delegation.targetAccountId}</span>
                    </p>
                    {delegation.reason && (
                      <p className="text-xs text-gray-600 line-clamp-2">{delegation.reason}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-400">{formatDate(delegation.createdAt)}</p>
                    {delegation.resolvedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Résolu : {formatDate(delegation.resolvedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
