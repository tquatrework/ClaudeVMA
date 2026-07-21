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
import { useParams, Navigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  fetchLegalDocuments,
  signLegalDocument,
  fetchSecureCopy,
  type LegalDocument,
} from '../api/legal'
import { LegalDocumentCard } from '../components/legal/LegalDocumentCard'

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

  // Un parent_financeur ne peut accéder qu'à ses propres documents légaux (LDS-FB-001).
  // AF, RP et TI peuvent accéder aux documents de n'importe quel utilisateur.
  const isAdminLegalRole = hasRole('administrateur_financier', 'responsable_pedagogique', 'technicien_informatique')
  if (ownerId && hasRole('parent_financeur') && !isAdminLegalRole && user?.id !== ownerId) {
    return <Navigate to="/forbidden" replace />
  }

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
            {legalDocuments.map((legalDocument) => (
              <LegalDocumentCard
                key={legalDocument.id}
                legalDocument={legalDocument}
                isBeingSigned={signingDocumentId === legalDocument.id}
                canSign={canSign}
                canDownloadSecureCopy={
                  isOwner ||
                  hasRole(
                    'administrateur_financier',
                    'responsable_pedagogique',
                    'technicien_informatique',
                  )
                }
                signerName={signerName}
                onSignerNameChange={setSignerName}
                signerEmail={signerEmail}
                onSignerEmailChange={setSignerEmail}
                signatureError={signatureErrors[legalDocument.id]}
                signatureSuccess={Boolean(signatureSuccesses[legalDocument.id])}
                isSubmittingSignature={isSubmittingSignature}
                onOpenSignatureForm={() => handleOpenSignatureForm(legalDocument.id)}
                onSubmitSignature={(event) => handleSubmitSignature(event, legalDocument.id)}
                onCancelSignatureForm={() => setSigningDocumentId(null)}
                isDownloadingSecureCopy={isDownloadingSecureCopy === legalDocument.id}
                onDownloadSecureCopy={() => handleDownloadSecureCopy(legalDocument.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}
