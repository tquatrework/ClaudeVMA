/**
 * LegalDocumentCard — carte d'un document légal (mandat / contrat) avec signature
 * et téléchargement de copie sécurisée.
 * Extrait de LegalDocumentsPage (lot 10 — normalisation, découpage > 300 lignes).
 * Présentationnel : le state (formulaire de signature, téléchargement en cours)
 * reste porté par la page.
 */

import React from 'react'
import type { LegalDocument, LegalDocumentType } from '../../api/legal'

const DOCUMENT_TYPE_LABELS: Record<LegalDocumentType, string> = {
  MANDAT_CLIENT: 'Mandat client',
  CONTRAT_FORMATEUR: 'Contrat formateur',
}

interface LegalDocumentCardProps {
  legalDocument: LegalDocument
  isBeingSigned: boolean
  canSign: boolean
  canDownloadSecureCopy: boolean
  signerName: string
  onSignerNameChange: (value: string) => void
  signerEmail: string
  onSignerEmailChange: (value: string) => void
  signatureError?: string
  signatureSuccess: boolean
  isSubmittingSignature: boolean
  onOpenSignatureForm: () => void
  onSubmitSignature: (event: React.FormEvent) => void
  onCancelSignatureForm: () => void
  isDownloadingSecureCopy: boolean
  onDownloadSecureCopy: () => void
}

export function LegalDocumentCard({
  legalDocument,
  isBeingSigned,
  canSign,
  canDownloadSecureCopy,
  signerName,
  onSignerNameChange,
  signerEmail,
  onSignerEmailChange,
  signatureError,
  signatureSuccess,
  isSubmittingSignature,
  onOpenSignatureForm,
  onSubmitSignature,
  onCancelSignatureForm,
  isDownloadingSecureCopy,
  onDownloadSecureCopy,
}: LegalDocumentCardProps) {
  const isAlreadySigned = legalDocument.status === 'SIGNE'

  return (
    <li className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
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
      {signatureSuccess && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Document signé avec succès.
        </div>
      )}

      {/* Formulaire de signature */}
      {!isAlreadySigned && canSign && (
        <div>
          {!isBeingSigned ? (
            <button
              onClick={onOpenSignatureForm}
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Signer ce document
            </button>
          ) : (
            <form
              onSubmit={onSubmitSignature}
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
                  onChange={(event) => onSignerNameChange(event.target.value)}
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
                  onChange={(event) => onSignerEmailChange(event.target.value)}
                  placeholder="adresse@exemple.fr"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              {signatureError && (
                <p className="text-xs text-red-600">
                  {signatureError}
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
                  onClick={onCancelSignatureForm}
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
      {isAlreadySigned && canDownloadSecureCopy && (
        <button
          onClick={onDownloadSecureCopy}
          disabled={isDownloadingSecureCopy}
          className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
        >
          {isDownloadingSecureCopy ? 'Téléchargement…' : 'Télécharger la copie sécurisée'}
        </button>
      )}
    </li>
  )
}
