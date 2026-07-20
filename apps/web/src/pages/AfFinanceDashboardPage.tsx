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
      <div style={{ marginBottom: '24px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--color-ink)',
            margin: 0,
          }}
        >
          Bonjour, {firstName}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Espace administrateur financier
        </p>
      </div>

      {/* KPIs */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}
        className="vm-af-kpis"
      >
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            style={{
              background: 'var(--color-white)',
              border: '1px solid var(--color-surface)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-card)',
              padding: '20px',
            }}
          >
            <p
              style={{
                fontSize: '28px',
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                color: 'var(--accent)',
                margin: '0 0 4px',
              }}
            >
              {kpi.value}
            </p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)', margin: '0 0 2px' }}>
              {kpi.label}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
              {kpi.description}
            </p>
          </div>
        ))}
      </div>

      {/* Actions rapides */}
      <div style={{ marginBottom: '28px' }}>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--color-ink)',
            marginBottom: '12px',
          }}
        >
          Actions rapides
        </h2>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}
          className="vm-af-actions"
        >
          {visibleQuickActions.map((action) => (
            <Link
              key={action.path}
              to={action.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px 12px',
                background: 'var(--color-white)',
                border: '1px solid var(--color-surface)',
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow-card)',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-ink)',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Grille : Paramètres rémunération + Événements récents */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}
        className="vm-grid-af"
      >
        {/* Paramètres rémunération */}
        <div
          style={{
            background: 'var(--color-white)',
            border: '1px solid var(--color-surface)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--color-ink)',
                margin: 0,
              }}
            >
              Rémunération
            </h3>
            {!isEditingRewards && (
              <button
                onClick={() => {
                  setEditedPointsPerEuro(rewardSettings.pointsPerEuro ?? 1)
                  setIsEditingRewards(true)
                  resetRewardSaveSuccess()
                }}
                style={{
                  fontSize: '12px',
                  color: 'var(--accent)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Modifier
              </button>
            )}
          </div>

          {rewardSaveSuccess && (
            <p style={{ fontSize: '12px', color: '#16a34a', marginBottom: '12px' }}>
              Paramètres mis à jour.
            </p>
          )}

          {isEditingRewards ? (
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                Points crédités par euro
              </label>
              <input
                type="number"
                value={editedPointsPerEuro}
                onChange={(event) => setEditedPointsPerEuro(Number(event.target.value))}
                min={0}
                step={0.1}
                style={{
                  border: '1px solid var(--color-surface)',
                  borderRadius: 'var(--radius-field)',
                  padding: '8px 12px',
                  fontSize: '14px',
                  width: '100px',
                  outline: 'none',
                  marginBottom: '12px',
                  display: 'block',
                }}
              />
              {rewardSaveError && (
                <p style={{ fontSize: '12px', color: '#dc2626', marginBottom: '8px' }}>{rewardSaveError}</p>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleSaveRewards}
                  disabled={isSavingRewards}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#fff',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 'var(--radius-field)',
                    padding: '7px 14px',
                    cursor: 'pointer',
                    opacity: isSavingRewards ? 0.6 : 1,
                  }}
                >
                  {isSavingRewards ? '…' : 'Enregistrer'}
                </button>
                <button
                  onClick={() => setIsEditingRewards(false)}
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                Taux actuel
              </p>
              <p style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
                {rewardSettings.pointsPerEuro ?? 1} pt/€
              </p>
            </div>
          )}
        </div>

        {/* Événements financiers récents */}
        <div
          style={{
            background: 'var(--color-white)',
            border: '1px solid var(--color-surface)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--color-ink)',
              margin: '0 0 16px',
            }}
          >
            Derniers mouvements
          </h3>

          {isLoadingEvents ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Chargement…</p>
          ) : eventsError ? (
            <p style={{ fontSize: '13px', color: '#dc2626' }}>{eventsError}</p>
          ) : financeEvents.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Aucun événement financier récent.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {financeEvents.slice(0, 12).map((financeEvent) => (
                <li
                  key={financeEvent.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--color-surface)',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 2px' }}>
                      {financeEvent.eventType}
                    </p>
                    {financeEvent.payload && (
                      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {JSON.stringify(financeEvent.payload).slice(0, 60)}
                        {JSON.stringify(financeEvent.payload).length > 60 ? '…' : ''}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
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
