import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import Layout from '../components/Layout'

interface WorkflowInstance {
  workflowInstanceId: string
  status: string
  reason?: string
}

/**
 * Page d'accord/refus utilisateur pour une modification nécessitant validation (FRONT-BR-009).
 * L'utilisateur peut accepter ou refuser — le résultat est tracé via orchestration-service.
 */
export default function AgreementsPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const [instance, setInstance] = useState<WorkflowInstance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!requestId) return
    apiClient
      .get<WorkflowInstance>(`/orchestration/workflows/${requestId}`)
      .then(({ data }) => setInstance(data))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 404) setError('Demande introuvable ou déjà traitée')
        else setError('Impossible de charger la demande')
      })
      .finally(() => setIsLoading(false))
  }, [requestId])

  const respond = async (decision: 'accept' | 'refuse') => {
    if (!requestId) return
    setIsProcessing(true)
    try {
      if (decision === 'accept') {
        await apiClient.post(`/orchestration/workflows/${requestId}/resume`)
      } else {
        await apiClient.post(`/orchestration/workflows/${requestId}/suspend`, {
          reason: 'Refusé par l\'utilisateur',
        })
      }
      setDone(true)
    } catch {
      setError('Erreur lors du traitement de votre réponse')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Demande d'accord</h1>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {done && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            Votre réponse a été enregistrée.{' '}
            <button onClick={() => navigate('/dashboard')} className="underline">
              Retour au tableau de bord
            </button>
          </div>
        )}

        {instance && !done && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Identifiant de la demande</p>
              <p className="text-sm text-gray-500 font-mono">{instance.workflowInstanceId}</p>
            </div>

            {instance.reason && (
              <div>
                <p className="text-sm font-medium text-gray-700">Motif</p>
                <p className="text-sm text-gray-800">{instance.reason}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Statut</p>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                {instance.status}
              </span>
            </div>

            <div className="pt-4 border-t border-gray-100 flex gap-3">
              <button
                disabled={isProcessing}
                onClick={() => respond('accept')}
                className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                Accepter
              </button>
              <button
                disabled={isProcessing}
                onClick={() => respond('refuse')}
                className="bg-red-500 text-white px-6 py-2 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
              >
                Refuser
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
