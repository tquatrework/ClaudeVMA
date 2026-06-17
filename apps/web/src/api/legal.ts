/**
 * Module API — legal-document-service (Phase 10)
 * Mandats, contrats et signatures légales.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LegalDocumentStatus = 'A_SIGNER' | 'SIGNE'
export type LegalDocumentType = 'MANDAT_CLIENT' | 'CONTRAT_FORMATEUR'

export interface SignatureRecord {
  id: string
  signerName: string
  signerEmail?: string
  signedAt: string
}

export interface LegalDocument {
  id: string
  ownerId: string
  documentType: LegalDocumentType
  status: LegalDocumentStatus
  templateId: string
  templateVersion: number
  signatureRecord?: SignatureRecord
  createdAt: string
}

export interface SignDocumentPayload {
  signerName: string
  signerEmail?: string
}

export interface SignDocumentResponse {
  legalDocument: LegalDocument
  signatureRecord: SignatureRecord
}

export interface LegalTemplate {
  id: string
  title: string
  documentType: LegalDocumentType
  version: number
  content: string
  isActive: boolean
  createdBy?: string
  lastModifiedBy?: string
  createdAt: string
  updatedAt?: string
}

export interface CreateLegalTemplatePayload {
  title: string
  documentType: LegalDocumentType
  content: string
}

export interface UpdateLegalTemplatePayload {
  title?: string
  content?: string
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * GET /legal-documents/:ownerId
 * Rôles autorisés : propriétaire, RP, TI, AF
 */
export async function fetchLegalDocuments(ownerId: string): Promise<LegalDocument[]> {
  const { data } = await apiClient.get<LegalDocument[]>(`/legal-documents/${ownerId}`)
  return Array.isArray(data) ? data : []
}

/**
 * POST /legal-documents/:id/sign
 * Signer un document (transition A_SIGNER → SIGNE). Propriétaire uniquement.
 * Retourne 409 si déjà signé (LDS-BR-002).
 */
export async function signLegalDocument(
  documentId: string,
  payload: SignDocumentPayload,
): Promise<SignDocumentResponse> {
  const { data } = await apiClient.post<SignDocumentResponse>(
    `/legal-documents/${documentId}/sign`,
    payload,
  )
  return data
}

/**
 * POST /legal-templates
 * Créer un modèle légal. AF uniquement (LDS-BR-001).
 */
export async function createLegalTemplate(
  payload: CreateLegalTemplatePayload,
): Promise<LegalTemplate> {
  const { data } = await apiClient.post<LegalTemplate>('/legal-templates', payload)
  return data
}

/**
 * PATCH /legal-templates/:id
 * Modifier un modèle (incrémente la version). AF uniquement (LDS-BR-001).
 */
export async function updateLegalTemplate(
  templateId: string,
  payload: UpdateLegalTemplatePayload,
): Promise<LegalTemplate> {
  const { data } = await apiClient.patch<LegalTemplate>(
    `/legal-templates/${templateId}`,
    payload,
  )
  return data
}

/**
 * GET /legal-documents/:id/secure-copy
 * Copie sécurisée d'un document signé. Accès restreint selon rôle.
 */
export async function fetchSecureCopy(documentId: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/legal-documents/${documentId}/secure-copy`, {
    responseType: 'blob',
  })
  return data
}
