import React, { useEffect, useState } from 'react'
import apiClient from '../api/client'
import Layout from '../components/Layout'

interface WorkflowInstance {
  workflowInstanceId: string
  workflowType: string
  status: string
  startedAt: string
  correlationId: string
}

/**
 * Vue activité interne — accessible aux rôles internes (RP, AP, TI, AdministrateurFinancier).
 * Affiche les instances de workflows de l'orchestration-service.
 */
export default function AdminActivityPage() {
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient
      .get<{ instance: WorkflowInstance; status: string }[]>('/orchestration/workflows')
      .then(({ data }) => setWorkflows(data.map((d) => d.instance ?? d) as WorkflowInstance[]))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError('Accès refusé — rôle interne requis')
        else setError("Impossible de charger l'activité")
      })
      .finally(() => setIsLoading(false))
  }, [])

  const STATUS_COLORS: Record<string, string> = {
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    needs_arbitration: 'bg-yellow-100 text-yellow-700',
    suspended: 'bg-gray-100 text-gray-500',
  }

  return (
    <Layout>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Activité interne</h1>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {!isLoading && !error && workflows.length === 0 && (
          <p className="text-gray-400 text-sm">Aucun workflow actif</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">Démarré le</th>
                <th className="px-4 py-3 text-left">Correlation ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workflows.map((wf) => (
                <tr key={wf.workflowInstanceId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{wf.workflowType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_COLORS[wf.status] ?? 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {wf.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(wf.startedAt).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {wf.correlationId?.slice(0, 12)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
