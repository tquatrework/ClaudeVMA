import React, { useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useAccountManagement } from '../hooks/accounts/useAccountManagement'
import type { AccountStatus } from '../types/accounts'

export default function AccountManagementPage() {
  const { hasRole } = useAuth()
  const {
    changeStatus,
    isChangingStatus,
    statusError,
    regenerateAccess,
    isRegeneratingAccess,
    regenerateError,
  } = useAccountManagement()

  // Status change form state
  const [statusAccountId, setStatusAccountId] = useState('')
  const [newAccountStatus, setNewAccountStatus] = useState<AccountStatus>('suspended')
  const [statusChangeReason, setStatusChangeReason] = useState('')
  const [statusSuccessMessage, setStatusSuccessMessage] = useState<string | null>(null)

  // Regenerate access form state
  const [regenerateAccountId, setRegenerateAccountId] = useState('')
  const [regenerateReason, setRegenerateReason] = useState('')
  const [regenerateSuccessMessage, setRegenerateSuccessMessage] = useState<string | null>(null)

  const isTechnicienInformatique = hasRole('technicien_informatique')

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatusSuccessMessage(null)

    const accountId = statusAccountId
    const success = await changeStatus(accountId, newAccountStatus, statusChangeReason)

    if (success) {
      setStatusSuccessMessage(`Statut du compte ${accountId} mis à jour vers "${newAccountStatus}".`)
      setStatusAccountId('')
      setStatusChangeReason('')
    }
  }

  const handleRegenerateAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegenerateSuccessMessage(null)

    const accountId = regenerateAccountId
    const success = await regenerateAccess(accountId, regenerateReason)

    if (success) {
      setRegenerateSuccessMessage(
        `Accès régénéré pour le compte ${accountId}. Le lien a été envoyé à l'utilisateur.`,
      )
      setRegenerateAccountId('')
      setRegenerateReason('')
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestion des comptes</h1>
        <p className="text-sm text-gray-500 mb-8">
          Interface réservée aux administrateurs pour modifier les statuts de comptes et réactiver
          les accès.
        </p>

        {/* Section: Change account status */}
        <section className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Changer le statut d'un compte</h2>
          <p className="text-xs text-gray-500 mb-4">
            Disponible pour : Responsable Pédagogique, Technicien Informatique
          </p>

          {statusSuccessMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {statusSuccessMessage}
            </div>
          )}
          {statusError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {statusError}
            </div>
          )}

          <form onSubmit={handleStatusChange} className="space-y-4">
            <div>
              <label htmlFor="status-account-id" className="block text-sm font-medium text-gray-700 mb-1">
                Identifiant du compte *
              </label>
              <input
                id="status-account-id"
                type="text"
                required
                value={statusAccountId}
                onChange={(e) => setStatusAccountId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="UUID du compte"
              />
            </div>

            <div>
              <label htmlFor="new-account-status" className="block text-sm font-medium text-gray-700 mb-1">
                Nouveau statut *
              </label>
              <select
                id="new-account-status"
                value={newAccountStatus}
                onChange={(e) => setNewAccountStatus(e.target.value as AccountStatus)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="active">Actif</option>
                <option value="suspended">Suspendu</option>
                <option value="pending">En attente</option>
              </select>
            </div>

            <div>
              <label htmlFor="status-change-reason" className="block text-sm font-medium text-gray-700 mb-1">
                Motif *
              </label>
              <textarea
                id="status-change-reason"
                required
                value={statusChangeReason}
                onChange={(e) => setStatusChangeReason(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                placeholder="Expliquez la raison du changement de statut…"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingStatus}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isChangingStatus ? 'Mise à jour…' : 'Appliquer le changement de statut'}
            </button>
          </form>
        </section>

        {/* Section: Regenerate access (TI only) */}
        {isTechnicienInformatique && (
          <section className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Réactiver un accès</h2>
            <p className="text-xs text-gray-500 mb-4">
              Disponible pour : Technicien Informatique uniquement. Cette action est auditée.
            </p>

            {regenerateSuccessMessage && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {regenerateSuccessMessage}
              </div>
            )}
            {regenerateError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {regenerateError}
              </div>
            )}

            <form onSubmit={handleRegenerateAccess} className="space-y-4">
              <div>
                <label htmlFor="regenerate-account-id" className="block text-sm font-medium text-gray-700 mb-1">
                  Identifiant du compte *
                </label>
                <input
                  id="regenerate-account-id"
                  type="text"
                  required
                  value={regenerateAccountId}
                  onChange={(e) => setRegenerateAccountId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="UUID du compte"
                />
              </div>

              <div>
                <label htmlFor="regenerate-reason" className="block text-sm font-medium text-gray-700 mb-1">
                  Motif de la réactivation *
                </label>
                <textarea
                  id="regenerate-reason"
                  required
                  value={regenerateReason}
                  onChange={(e) => setRegenerateReason(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  placeholder="Décrivez la raison de cette réactivation (sera auditée)…"
                />
              </div>

              <button
                type="submit"
                disabled={isRegeneratingAccess}
                className="w-full bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {isRegeneratingAccess ? 'Traitement…' : "Régénérer l'accès"}
              </button>
            </form>
          </section>
        )}
      </div>
    </Layout>
  )
}
