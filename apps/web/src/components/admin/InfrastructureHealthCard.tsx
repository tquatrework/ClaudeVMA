/**
 * InfrastructureHealthCard — carte de santé globale de l'infrastructure (dashboard TI).
 * Extrait de TiAdminDashboard (lot 10 — normalisation, découpage > 300 lignes).
 * Rendu identique à l'origine.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import type { HealthStatusReport, ServiceHealthStatus } from '../../api/adminObservability'

const HEALTH_STATUS_LABELS: Record<ServiceHealthStatus, string> = {
  healthy: 'Opérationnel',
  degraded: 'Dégradé',
  down: 'Hors service',
  unknown: 'Inconnu',
}

const HEALTH_STATUS_COLORS: Record<ServiceHealthStatus, { bg: string; text: string }> = {
  healthy: { bg: '#f0fdf4', text: '#16a34a' },
  degraded: { bg: '#fefce8', text: '#ca8a04' },
  down: { bg: '#fef2f2', text: '#dc2626' },
  unknown: { bg: '#f9fafb', text: '#6b7280' },
}

interface InfrastructureHealthCardProps {
  healthReport: HealthStatusReport | null
  isLoadingHealth: boolean
}

export function InfrastructureHealthCard({ healthReport, isLoadingHealth }: InfrastructureHealthCardProps) {
  const overallStatus: ServiceHealthStatus = healthReport?.overallStatus ?? 'unknown'
  const overallColors = HEALTH_STATUS_COLORS[overallStatus]

  // Séparer les services en alertes et sains
  const alertServices = (healthReport?.services ?? []).filter(
    (service) => service.status !== 'healthy',
  )
  const healthyServices = (healthReport?.services ?? []).filter(
    (service) => service.status === 'healthy',
  )

  return (
    <div
      style={{
        background: 'var(--color-white)',
        border: `1px solid ${overallColors.bg === '#f0fdf4' ? '#bbf7d0' : overallColors.bg === '#fefce8' ? '#fde68a' : overallColors.bg === '#fef2f2' ? '#fecaca' : 'var(--color-surface)'}`,
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        padding: '20px',
        marginBottom: '24px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--color-ink)',
              margin: '0 0 4px',
            }}
          >
            État de l'infrastructure
          </h2>
          {isLoadingHealth ? (
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Vérification en cours…
            </p>
          ) : healthReport ? (
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Vérifié le {new Date(healthReport.checkedAt).toLocaleString('fr-FR')}
            </p>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Impossible de récupérer l'état
            </p>
          )}
        </div>
        {!isLoadingHealth && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: overallColors.text,
              background: overallColors.bg,
              borderRadius: 'var(--radius-pill)',
              padding: '4px 12px',
            }}
          >
            {HEALTH_STATUS_LABELS[overallStatus]}
          </span>
        )}
      </div>

      {/* Alertes en premier */}
      {alertServices.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Services en anomalie
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {alertServices.map((serviceInfo) => {
              const serviceColors = HEALTH_STATUS_COLORS[serviceInfo.status]
              return (
                <div
                  key={serviceInfo.service}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: serviceColors.bg,
                    borderRadius: 'var(--radius-field)',
                    border: '1px solid transparent',
                  }}
                >
                  <span style={{ fontSize: '12px', color: 'var(--color-ink)', fontWeight: 500 }}>
                    {serviceInfo.service}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: serviceColors.text, marginLeft: '8px' }}>
                    {HEALTH_STATUS_LABELS[serviceInfo.status]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Services sains */}
      {healthyServices.length > 0 && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Services opérationnels ({healthyServices.length})
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
            {healthyServices.slice(0, 8).map((serviceInfo) => (
              <div
                key={serviceInfo.service}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '7px 12px',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-field)',
                }}
              >
                <span style={{ fontSize: '12px', color: 'var(--color-ink)' }}>
                  {serviceInfo.service}
                </span>
                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginLeft: '8px' }}>
                  OK
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link
        to="/admin/observability/health"
        style={{
          display: 'inline-block',
          marginTop: '16px',
          fontSize: '12px',
          color: 'var(--accent)',
          textDecoration: 'none',
        }}
      >
        Vue détaillée →
      </Link>
    </div>
  )
}
