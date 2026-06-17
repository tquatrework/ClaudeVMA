/**
 * LegalDocumentsPage — Phase 10
 *
 * Affiche les documents légaux d'un utilisateur (mandats, contrats).
 * Permet au propriétaire de signer ses documents (transition A_SIGNER → SIGNE).
 * Interdit de re-signer un document déjà signé (409).
 *
 * Rôles autorisés en lecture : propriétaire, RP, TI, AF
 * Signature : propriétaire uniquement
 */

import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  fetchLegalDocuments,
  signLegalDocument,
  fetchSecureCopy,
  type LegalDocument,
  type LegalDocumentType,
} from '../api/legal'

const DOCUMENT_TYPE_LABELS: Record<LegalDocumentType, string> = {
  MANDAT_CLIENT: 'Mandat client',
  CONTRAT_FORMATEUR: 'Contrat formateur',
}

export default function LegalDocumentsPage() {
  const { ownerId } = useParams<{ ownerId: string }>()
  const { user, hasRole } = useAuth()

  const [legalDocuments, setLegalDocuments] = useState<LegalDocument[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Signature state par document
  const [signingDocumentId, setSigningDocumentId] = useState<string | null>(null)
  const [signerName, setSignerName] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false)
  const [signatureErrors, setSignatureErrors] = useState<Record<string, string>>({})
  const [signatureSuccesses, setSignatureSuccesses] = useState<Record<string, boolean>>({})

  // Accès copie sécurisée
  const [isDownloadingSecureCopy, setIsDownloadingSecureCopy] = useState<string | null>(null)

  const resolvedOwnerId = ownerId ?? user?.id ?? ''

  const isOwner = user?.id === resolvedOwnerId
  const canSign = isOwner

  useEffect(() => {
    if (!resolvedOwnerId) return

    setIsLoadingDocuments(true)
    fetchLegalDocuments(resolvedOwnerId)
      .then(setLegalDocuments)
      .catch((error) => {
        const statusCode = error?.response?.status
        if (statusCode === 403) {
          setLoadError('Accès refusé.')
        } else if (statusCode === 404) {
          setLoadError('Utilisateur introuvable.')
        } else {
          setLoadError('Impossible de charger les documents légaux.')
        }
      })
      .finally(() => setIsLoadingDocuments(false))
  }, [resolvedOwnerId])

  const handleOpenSignatureForm = (documentId: string) => {
    setSigningDocumentId(documentId)
    setSignerName(user?.email ?? '')
    setSignerEmail('')
  }

  const handleSubmitSignature = async (event: React.FormEvent, documentId: string) => {
    event.preventDefault()
    if (!signerName.trim()) return

    setIsSubmittingSignature(true)
    setSignatureErrors((previous) => ({ ...previous, [documentId]: '' }))

    try {
      const response = await signLegalDocument(documentId, {
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim() || undefined,
      })
      setLegalDocuments((previous) =>
        previous.map((document) =>
          document.id === documentId ? response.legalDocument : document,
        ),
      )
      setSignatureSuccesses((previous) => ({ ...previous, [documentId]: true }))
      setSigningDocumentId(null)
    } catch (error: unknown) {
      const statusCode = (error as { response?: { status?: number } })?.response?.status
      let errorMessage = 'Erreur lors de la signature.'
      if (statusCode === 409) {
        errorMessage = 'Ce document a déjà été signé.'
      } else if (statusCode === 403) {
        errorMessage = 'Vous n\'êtes pas autorisé à signer ce document.'
      }
      setSignatureErrors((previous) => ({ ...previous, [documentId]: errorMessage }))
    } finally {
      setIsSubmittingSignature(false)
    }
  }

  const handleDownloadSecureCopy = async (documentId: string) => {
    setIsDownloadingSecureCopy(documentId)
    try {
      const blobData = await fetchSecureCopy(documentId)
      const url = URL.createObjectURL(blobData)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `document-${documentId}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      /* non-bloquant */
    } finally {
      setIsDownloadingSecureCopy(null)
    }
  }

  if (isLoadingDocuments) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement…</p>
      </Layout>
    )
  }

  if (loadError) {
    return (
      <Layout>
        <p className="text-red-600">{loadError}</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents légaux</h1>
          <p className="text-gray-500 text-sm mt-1">
            Mandats et contrats associés à votre compte.
          </p>
        </div>

        {legalDocuments.length === 0 ? (
          <p className="text-gray-400 text-sm">Aucun document légal disponible.</p>
        ) : (
          <ul className="space-y-4">
            {legalDocuments.map((legalDocument) => {
              const isAlreadySigned = legalDocument.status === 'SIGNE'
              const isBeingSigned = signingDocumentId === legalDocument.id

              return (
                <li
                  key={legalDocument.id}
                  className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-gray-900">
                        {DOCUMENT_TYPE_LABELS[legalDocument.documentType]}
                      </h3>
                      <p className="text-xs text-gray-500">
                        Version {legalDocument.templateVersion} · Créé le{' '}
                        {new Date(legalDocument.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right space-y-2 shrink-0">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          isAlreadySigned
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {isAlreadySigned ? 'Signé' : 'À signer'}
                      </span>
                    </div>
                  </div>

                  {/* Données de signature si signé */}
                  {isAlreadySigned && legalDocument.signatureRecord && (
                    <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 text-sm text-green-800 space-y-1">
                      <p>
                        Signé par <strong>{legalDocument.signatureRecord.signerName}</strong>
                        {legalDocument.signatureRecord.signerEmail && (
                          <span> ({legalDocument.signatureRecord.signerEmail})</span>
                        )}
                      </p>
                      <p className="text-xs text-green-600">
                        Le{' '}
                        {new Date(legalDocument.signatureRecord.signedAt).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  )}

                  {/* Succès de signature */}
                  {signatureSuccesses[legalDocument.id] && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                      Document signé avec succès.
                    </div>
                  )}

                  {/* Formulaire de signature */}
                  {!isAlreadySigned && canSign && (
                    <div>
                      {!isBeingSigned ? (
                        <button
                          onClick={() => handleOpenSignatureForm(legalDocument.id)}
                          className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                        >
                          Signer ce document
                        </button>
                      ) : (
                        <form
                          onSubmit={(event) => handleSubmitSignature(event, legalDocument.id)}
                          className="space-y-3 border border-indigo-100 bg-indigo-50 rounded-lg p-4"
                        >
                          <h4 className="text-sm font-medium text-indigo-800">
                            Confirmer votre signature
                          </h4>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Nom complet du signataire *
                            </label>
                            <input
                              type="text"
                              value={signerName}
                              onChange={(event) => setSignerName(event.target.value)}
                              required
                              placeholder="Prénom Nom"
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Email du signataire (optionnel)
                            </label>
                            <input
                              type="email"
                              value={signerEmail}
                              onChange={(event) => setSignerEmail(event.target.value)}
                              placeholder="adresse@exemple.fr"
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                          </div>
                          {signatureErrors[legalDocument.id] && (
                            <p className="text-xs text-red-600">
                              {signatureErrors[legalDocument.id]}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={isSubmittingSignature || !signerName.trim()}
                              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                            >
                              {isSubmittingSignature ? 'Signature…' : 'Confirmer la signature'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSigningDocumentId(null)}
                              className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2"
                            >
                              Annuler
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {/* Copie sécurisée (documents signés) */}
                  {isAlreadySigned &&
                    (isOwner ||
                      hasRole(
                        'administrateur_financier',
                        'responsable_pedagogique',
                        'technicien_informatique',
                      )) && (
                      <button
                        onClick={() => handleDownloadSecureCopy(legalDocument.id)}
                        disabled={isDownloadingSecureCopy === legalDocument.id}
                        className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                      >
                        {isDownloadingSecureCopy === legalDocument.id
                          ? 'Téléchargement…'
                          : 'Télécharger la copie sécurisée'}
                      </button>
                    )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Layout>
  )
}
