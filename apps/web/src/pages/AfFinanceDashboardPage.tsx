/**
 * AfFinanceDashboardPage — Phase 9
 *
 * Tableau de bord AF (Administrateur Financier).
 * Accès restreint : administrateur_financier uniquement.
 *
 * Contient :
 * - Vue des événements financiers récents
 * - Accès aux paramètres de rémunération (RewardSettings)
 * - Liens vers profils financiers et demandes de paiement formateur
 */

import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import apiClient from '../api/client'

interface FinanceEvent {
  id: string
  eventType: string
  payload?: Record<string, unknown>
  occurredAt: string
}

interface RewardSettings {
  pointsPerEuro?: number
  bonusMultiplier?: number
}

export default function AfFinanceDashboardPage() {
  const { user, hasRole } = useAuth()
  const navigate = useNavigate()

  const [financeEvents, setFinanceEvents] = useState<FinanceEvent[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [rewardSettings, setRewardSettings] = useState<RewardSettings>({ pointsPerEuro: 1 })
  const [isEditingRewards, setIsEditingRewards] = useState(false)
  const [pointsPerEuro, setPointsPerEuro] = useState(1)
  const [isSavingRewards, setIsSavingRewards] = useState(false)
  const [rewardSaveError, setRewardSaveError] = useState<string | null>(null)
  const [rewardSaveSuccess, setRewardSaveSuccess] = useState(false)

  useEffect(() => {
    if (!hasRole('administrateur_financier')) {
      navigate('/forbidden', { replace: true })
      return
    }

    apiClient
      .get<FinanceEvent[]>('/finance-events')
      .then(({ data }) => setFinanceEvents(Array.isArray(data) ? data : []))
      .catch(() => { /* non-bloquant */ })
      .finally(() => setIsLoadingEvents(false))
  }, [hasRole, navigate])

  const handleSaveRewards = async () => {
    setIsSavingRewards(true)
    setRewardSaveError(null)
    setRewardSaveSuccess(false)

    try {
      await apiClient.patch('/financial-settings/rewards', { pointsPerEuro })
      setRewardSettings({ pointsPerEuro })
      setIsEditingRewards(false)
      setRewardSaveSuccess(true)
    } catch {
      setRewardSaveError('Impossible de mettre à jour les paramètres de rémunération.')
    } finally {
      setIsSavingRewards(false)
    }
  }

  if (!hasRole('administrateur_financier')) {
    return null
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Espace Administrateur Financier</h1>
          <p className="text-gray-500 text-sm mt-1">Connecté en tant que : {user?.loginIdentifier}</p>
        </div>

        {/* Accès rapides */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Actions rapides</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Link
              to={`/finance/${user?.id}`}
              className="flex items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all text-sm font-medium text-gray-700 text-center"
            >
              Mon profil financier
            </Link>
            <Link
              to="/legal/templates"
              className="flex items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all text-sm font-medium text-gray-700 text-center"
            >
              Modèles légaux
            </Link>
            <Link
              to="/delegations"
              className="flex items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all text-sm font-medium text-gray-700 text-center"
            >
              Délégations
            </Link>
          </div>
        </section>

        {/* Paramètres de rémunération */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-700">Paramètres de rémunération</h2>
            {!isEditingRewards && (
              <button
                onClick={() => {
                  setPointsPerEuro(rewardSettings.pointsPerEuro ?? 1)
                  setIsEditingRewards(true)
                  setRewardSaveSuccess(false)
                }}
                className="text-xs text-indigo-600 hover:underline"
              >
                Modifier
              </button>
            )}
          </div>

          {rewardSaveSuccess && (
            <p className="text-xs text-green-600">Paramètres mis à jour avec succès.</p>
          )}

          {isEditingRewards ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Points crédités par euro dépensé</label>
                <input
                  type="number"
                  value={pointsPerEuro}
                  onChange={(event) => setPointsPerEuro(Number(event.target.value))}
                  min={0}
                  step={0.1}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              {rewardSaveError && (
                <p className="text-xs text-red-600">{rewardSaveError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveRewards}
                  disabled={isSavingRewards}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSavingRewards ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  onClick={() => setIsEditingRewards(false)}
                  className="text-xs text-gray-600 hover:text-gray-800"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-800">
              <span className="font-semibold text-indigo-600">
                {rewardSettings.pointsPerEuro ?? 1}
              </span>{' '}
              point(s) par euro dépensé
            </p>
          )}
        </section>

        {/* Événements financiers récents */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Événements financiers récents
          </h2>
          {isLoadingEvents ? (
            <p className="text-gray-400 text-sm">Chargement…</p>
          ) : financeEvents.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucun événement financier récent.</p>
          ) : (
            <ul className="space-y-2">
              {financeEvents.slice(0, 20).map((financeEvent) => (
                <li
                  key={financeEvent.id}
                  className="p-3 bg-white border border-gray-200 rounded-lg flex items-center justify-between gap-4 text-sm"
                >
                  <div>
                    <span className="font-medium text-gray-800">{financeEvent.eventType}</span>
                    {financeEvent.payload && (
                      <span className="ml-2 text-xs text-gray-400">
                        {JSON.stringify(financeEvent.payload).slice(0, 60)}
                        {JSON.stringify(financeEvent.payload).length > 60 ? '…' : ''}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">
                    {new Date(financeEvent.occurredAt).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  )
}
