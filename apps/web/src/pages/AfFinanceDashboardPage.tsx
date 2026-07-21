/**
 * AfFinanceDashboardPage — Dashboard Administrateur Financier
 * Accent : Ardoise oklch(0.52 0.07 250)
 */

import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFinanceDashboard } from '../hooks/finance/useFinanceDashboard'
import DashboardShell from '../components/dashboard/DashboardShell'
import type { NavItem } from '../types/navigation'
import { getRailGroupsForRole } from '../navigation/navigationConfig'
import { useCanAccess } from '../navigation/navigationFilters'
import '../styles/tokens.css'

// Tous les items de topbar potentiels pour l'AF — filtrés dynamiquement
const ALL_TOP_NAV_ITEMS: NavItem[] = [
  { label: 'Accueil', path: '/admin/finance' },
  { label: 'Profils financiers', path: '/finance' },
  { label: 'Paiements', path: '/teacher-payment-requests' },
  { label: 'Documents légaux', path: '/legal' },
  { label: 'Activité', path: '/admin/activity' },
]

// Tous les liens d'actions rapides potentiels — filtrés dynamiquement
const ALL_QUICK_ACTIONS = [
  { label: 'Profils financiers', path: '/finance' },
  { label: 'Modèles légaux', path: '/legal/templates' },
  { label: 'Délégations', path: '/delegations' },
  { label: 'Paiements formateurs', path: '/teacher-payment-requests' },
  { label: 'Export activités', path: '/admin/activities/export' },
  { label: 'Workflows', path: '/admin/orchestration/workflows' },
]

export default function AfFinanceDashboardPage() {
  const { user, hasRole } = useAuth()
  const { checkAccess } = useCanAccess()
  const navigate = useNavigate()
  const firstName = user?.loginIdentifier ?? 'vous'

  // Filtrer la topbar et les actions rapides selon les droits réels du rôle courant
  const visibleTopNavItems = ALL_TOP_NAV_ITEMS.filter((item) => checkAccess(item.path))
  const visibleQuickActions = ALL_QUICK_ACTIONS.filter((action) => checkAccess(action.path))

  // Rail gauche depuis la config centralisée (déjà scopé par rôle)
  const railGroups = user ? getRailGroupsForRole(user.role) : []

  const isAf = hasRole('administrateur_financier')

  useEffect(() => {
    if (!isAf) {
      navigate('/forbidden', { replace: true })
    }
  }, [isAf, navigate])

  const {
    financeEvents,
    isLoadingEvents,
    eventsError,
    rewardSettings,
    saveRewardSettings,
    isSavingRewards,
    rewardSaveError,
    rewardSaveSuccess,
    resetRewardSaveSuccess,
  } = useFinanceDashboard(isAf)

  const [isEditingRewards, setIsEditingRewards] = useState(false)
  const [editedPointsPerEuro, setEditedPointsPerEuro] = useState(1)

  const handleSaveRewards = async () => {
    const success = await saveRewardSettings(editedPointsPerEuro)
    if (success) {
      setIsEditingRewards(false)
    }
  }

  if (!isAf) return null

  // TODO: brancher API KPIs financiers
  const kpiCards = [
    { label: 'Crédits actifs', value: '—', description: 'Total en circulation' },
    { label: 'Paiements en attente', value: '—', description: 'Formateurs à payer' },
    { label: 'Factures émises (mois)', value: '—', description: 'Ce mois-ci' },
  ]

  return (
    <DashboardShell
      accentClass="role-af"
      railGroups={railGroups}
      topNavItems={visibleTopNavItems}
      userName={firstName}
      userRole="Administrateur financier"
    >
      {/* Salutation */}
      <div className="mb-6">
        <h1 className="font-[var(--font-heading)] text-[24px] font-bold text-[color:var(--color-ink)] m-0">
          Bonjour, {firstName}
        </h1>
        <p className="text-[13px] text-[color:var(--color-text-secondary)] mt-1">
          Espace administrateur financier
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-7 vm-af-kpis">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            style={{ boxShadow: 'var(--shadow-card)' }}
            className="bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] p-5"
          >
            <p className="text-[28px] font-[var(--font-heading)] font-bold text-[color:var(--accent)] mb-1">
              {kpi.value}
            </p>
            <p className="text-[13px] font-semibold text-[color:var(--color-ink)] mb-0.5">
              {kpi.label}
            </p>
            <p className="text-[11px] text-[color:var(--color-text-secondary)] m-0">
              {kpi.description}
            </p>
          </div>
        ))}
      </div>

      {/* Actions rapides */}
      <div className="mb-7">
        <h2 className="font-[var(--font-heading)] text-[15px] font-semibold text-[color:var(--color-ink)] mb-3">
          Actions rapides
        </h2>
        <div className="grid grid-cols-3 gap-2.5 vm-af-actions">
          {visibleQuickActions.map((action) => (
            <Link
              key={action.path}
              to={action.path}
              style={{ boxShadow: 'var(--shadow-card)' }}
              className="flex items-center justify-center py-3.5 px-3 bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] text-[13px] font-medium text-[color:var(--color-ink)] no-underline text-center"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Grille : Paramètres rémunération + Événements récents */}
      <div className="grid grid-cols-[1fr_2fr] gap-6 vm-grid-af">
        {/* Paramètres rémunération */}
        <div
          style={{ boxShadow: 'var(--shadow-card)' }}
          className="bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] p-5"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-[var(--font-heading)] text-[15px] font-semibold text-[color:var(--color-ink)] m-0">
              Rémunération
            </h3>
            {!isEditingRewards && (
              <button
                onClick={() => {
                  setEditedPointsPerEuro(rewardSettings.pointsPerEuro ?? 1)
                  setIsEditingRewards(true)
                  resetRewardSaveSuccess()
                }}
                className="text-[12px] text-[color:var(--accent)] bg-transparent border-none cursor-pointer p-0"
              >
                Modifier
              </button>
            )}
          </div>

          {rewardSaveSuccess && (
            <p className="text-[12px] text-green-600 mb-3">
              Paramètres mis à jour.
            </p>
          )}

          {isEditingRewards ? (
            <div>
              <label className="block text-[12px] text-[color:var(--color-text-secondary)] mb-1.5">
                Points crédités par euro
              </label>
              <input
                type="number"
                value={editedPointsPerEuro}
                onChange={(event) => setEditedPointsPerEuro(Number(event.target.value))}
                min={0}
                step={0.1}
                className="border border-[var(--color-surface)] rounded-[var(--radius-field)] py-2 px-3 text-[14px] w-[100px] outline-none mb-3 block"
              />
              {rewardSaveError && (
                <p className="text-[12px] text-red-600 mb-2">{rewardSaveError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveRewards}
                  disabled={isSavingRewards}
                  style={{ opacity: isSavingRewards ? 0.6 : 1 }}
                  className="text-[12px] font-semibold text-white bg-[var(--accent)] border-none rounded-[var(--radius-field)] py-[7px] px-3.5 cursor-pointer"
                >
                  {isSavingRewards ? '…' : 'Enregistrer'}
                </button>
                <button
                  onClick={() => setIsEditingRewards(false)}
                  className="text-[12px] text-[color:var(--color-text-secondary)] bg-transparent border-none cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[13px] text-[color:var(--color-text-secondary)] mb-1">
                Taux actuel
              </p>
              <p className="text-[24px] font-[var(--font-heading)] font-bold text-[color:var(--accent)] m-0">
                {rewardSettings.pointsPerEuro ?? 1} pt/€
              </p>
            </div>
          )}
        </div>

        {/* Événements financiers récents */}
        <div
          style={{ boxShadow: 'var(--shadow-card)' }}
          className="bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] p-5"
        >
          <h3 className="font-[var(--font-heading)] text-[15px] font-semibold text-[color:var(--color-ink)] mb-4">
            Derniers mouvements
          </h3>

          {isLoadingEvents ? (
            <p className="text-[13px] text-[color:var(--color-text-secondary)]">Chargement…</p>
          ) : eventsError ? (
            <p className="text-[13px] text-red-600">{eventsError}</p>
          ) : financeEvents.length === 0 ? (
            <p className="text-[13px] text-[color:var(--color-text-secondary)]">
              Aucun événement financier récent.
            </p>
          ) : (
            <ul className="list-none m-0 p-0">
              {financeEvents.slice(0, 12).map((financeEvent) => (
                <li
                  key={financeEvent.id}
                  className="flex justify-between items-start py-2.5 border-b border-[var(--color-surface)] gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[color:var(--color-ink)] mb-0.5">
                      {financeEvent.eventType}
                    </p>
                    {financeEvent.payload && (
                      <p className="text-[11px] text-[color:var(--color-text-secondary)] m-0 overflow-hidden text-ellipsis whitespace-nowrap">
                        {JSON.stringify(financeEvent.payload).slice(0, 60)}
                        {JSON.stringify(financeEvent.payload).length > 60 ? '…' : ''}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-[color:var(--color-text-secondary)] shrink-0">
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
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .vm-af-kpis { grid-template-columns: 1fr 1fr !important; }
          .vm-af-actions { grid-template-columns: 1fr 1fr !important; }
          .vm-grid-af { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .vm-af-kpis { grid-template-columns: 1fr !important; }
          .vm-af-actions { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </DashboardShell>
  )
}
