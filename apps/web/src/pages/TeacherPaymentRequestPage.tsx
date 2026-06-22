/**
 * TeacherPaymentRequestPage — Phase 9
 *
 * Permet à un formateur de soumettre une demande de paiement.
 * Permet à l'AF de valider les demandes en attente.
 *
 * Rôles :
 * - formateur : soumettre une demande
 * - administrateur_financier : valider ou refuser
 */

import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import apiClient from '../api/client'

interface TeacherPaymentRequest {
  id: string
  teacherId: string
  amountCents: number
  description: string
  invoiceReference?: string
  status: 'pending' | 'validated' | 'rejected'
  createdAt: string
}

export default function TeacherPaymentRequestPage() {
  const { user, hasRole } = useAuth()

  const [paymentRequests, setPaymentRequests] = useState<TeacherPaymentRequest[]>([])
  const [isLoadingRequests, setIsLoadingRequests] = useState(true)

  // Form state (formateur)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [requestAmountCents, setRequestAmountCents] = useState(0)
  const [requestDescription, setRequestDescription] = useState('')
  const [invoiceReference, setInvoiceReference] = useState('')
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const isFormateur = hasRole('formateur')
  const isAF = hasRole('administrateur_financier')

  useEffect(() => {
    apiClient
      .get<TeacherPaymentRequest[]>('/teacher-payment-requests')
      .then(({ data }) => setPaymentRequests(Array.isArray(data) ? data : []))
      .catch(() => { /* non-bloquant */ })
      .finally(() => setIsLoadingRequests(false))
  }, [user])

  const handleSubmitRequest = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!requestDescription.trim() || requestAmountCents <= 0) return

    setIsSubmittingRequest(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    try {
      const { data } = await apiClient.post<TeacherPaymentRequest>('/teacher-payment-requests', {
        amountCents: requestAmountCents,
        description: requestDescription.trim(),
        invoiceReference: invoiceReference.trim() || undefined,
      })
      setPaymentRequests((previous) => [data, ...previous])
      setIsFormOpen(false)
      setRequestAmountCents(0)
      setRequestDescription('')
      setInvoiceReference('')
      setSubmitSuccess(true)
    } catch {
      setSubmitError('Impossible de soumettre la demande de paiement.')
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  const handleValidateRequest = async (requestId: string) => {
    try {
      const { data } = await apiClient.post<TeacherPaymentRequest>(
        `/teacher-payment-requests/${requestId}/validate`,
      )
      setPaymentRequests((previous) =>
        previous.map((request) => (request.id === requestId ? data : request)),
      )
    } catch {
      /* non-bloquant */
    }
  }

  const STATUS_LABELS: Record<TeacherPaymentRequest['status'], string> = {
    pending: 'En attente',
    validated: 'Validée',
    rejected: 'Refusée',
  }

  const STATUS_COLORS: Record<TeacherPaymentRequest['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    validated: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Demandes de paiement formateur</h1>
            <p className="text-gray-500 text-sm mt-1">
              {isFormateur && 'Soumettez vos demandes de règlement pour vos prestations.'}
              {isAF && 'Validez ou refusez les demandes de paiement des formateurs.'}
            </p>
          </div>
          {isFormateur && (
            <button
              onClick={() => {
                setIsFormOpen(true)
                setSubmitSuccess(false)
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
            >
              Nouvelle demande
            </button>
          )}
        </div>

        {/* Succès de soumission */}
        {submitSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Demande soumise avec succès.
          </div>
        )}

        {/* Formulaire formateur */}
        {isFormOpen && isFormateur && (
          <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-700">Nouvelle demande de paiement</h2>
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Montant (centimes)</label>
                <input
                  type="number"
                  value={requestAmountCents}
                  onChange={(event) => setRequestAmountCents(Number(event.target.value))}
                  min={1}
                  required
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <p className="text-xs text-gray-400 mt-0.5">
                  {(requestAmountCents / 100).toFixed(2)} €
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Description de la prestation</label>
                <textarea
                  value={requestDescription}
                  onChange={(event) => setRequestDescription(event.target.value)}
                  required
                  rows={3}
                  placeholder="Décrivez la prestation effectuée…"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Référence facture (optionnel)</label>
                <input
                  type="text"
                  value={invoiceReference}
                  onChange={(event) => setInvoiceReference(event.target.value)}
                  placeholder="ex: FACT-2026-001"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              {submitError && <p className="text-xs text-red-600">{submitError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmittingRequest || requestAmountCents <= 0 || !requestDescription.trim()}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmittingRequest ? 'Soumission…' : 'Soumettre la demande'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2"
                >
                  Annuler
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Liste des demandes */}
        <section>
          {isLoadingRequests ? (
            <p className="text-gray-400 text-sm">Chargement…</p>
          ) : paymentRequests.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune demande de paiement.</p>
          ) : (
            <ul className="space-y-3">
              {paymentRequests.map((paymentRequest) => (
                <li
                  key={paymentRequest.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-800">{paymentRequest.description}</p>
                      <p className="text-xs text-gray-500">
                        Formateur : <span className="font-mono">{paymentRequest.teacherId.slice(0, 8)}…</span>
                        {paymentRequest.invoiceReference && (
                          <span className="ml-2">· Facture : {paymentRequest.invoiceReference}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(paymentRequest.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right space-y-2 shrink-0">
                      <p className="text-sm font-bold text-gray-800">
                        {(paymentRequest.amountCents / 100).toFixed(2)} €
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          STATUS_COLORS[paymentRequest.status]
                        }`}
                      >
                        {STATUS_LABELS[paymentRequest.status]}
                      </span>
                      {isAF && paymentRequest.status === 'pending' && (
                        <button
                          onClick={() => handleValidateRequest(paymentRequest.id)}
                          className="block w-full mt-1 text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700"
                        >
                          Valider
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  )
}
