/**
 * Module API — communication-service
 * Messagerie (conversations/messages), incidents et délégations.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Les Contacts (refondus le 2026-09-04, voir docs/architecture/contacts-messagerie.md)
 * vivent dans `api/contacts.ts` — extraits d'ici le 2026-09-05 pour rester sous la
 * limite de 300 lignes une fois la refonte Contacts ajoutée.
 *
 * Écart signalé (non documenté dans docs/routes.md — comportement runtime préservé tel
 * quel, ne pas corriger ici) :
 * - GET/POST /delegations n'apparaissent dans aucune section de docs/routes.md (ni
 *   communication-service, ni ailleurs). Route utilisée par DelegationsPage avant cette
 *   migration ; reproduite à l'identique.
 */

import apiClient from './client'

// ─── Types — Conversations et messages ─────────────────────────────────────────

export interface Conversation {
  id: string
  participantIds: string[]
  subject: string | null
  isIncident: boolean
  incidentId: string | null
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  content: string
  attachmentRef: string | null
  isSystem: boolean
  isRead: boolean
  sentAt: string
}

export interface CreateConversationPayload {
  participantIds: string[]
  subject?: string
}

export interface SendMessagePayload {
  content: string
  attachmentRef?: string
}

export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface Incident {
  id: string
  title: string
  description?: string
  status: IncidentStatus
  createdAt: string
  updatedAt?: string
  reporterId?: string
}

export interface CreateIncidentPayload {
  title: string
  description?: string
}

export interface UpdateIncidentStatusPayload {
  status: IncidentStatus
}

export type DelegationStatus = 'pending' | 'approved' | 'rejected' | 'executed'

export interface Delegation {
  id: string
  requesterId: string
  targetAccountId: string
  action: string
  status: DelegationStatus
  reason: string
  createdAt: string
  resolvedAt?: string
}

export interface CreateDelegationPayload {
  targetAccountId: string
  action: string
  reason: string
}

// ─── Conversations ────────────────────────────────────────────────────────────

/**
 * GET /conversations — Lister mes conversations
 */
export async function fetchConversations(): Promise<Conversation[]> {
  const { data } = await apiClient.get<Conversation[]>('/conversations')
  return Array.isArray(data) ? data : []
}

/**
 * POST /conversations — Créer une conversation entre contacts actifs.
 * `participantIds` ne doit lister QUE les autres participants (jamais l'appelant
 * lui-même) — le serveur l'ajoute automatiquement à la liste complète.
 */
export async function createConversation(
  payload: CreateConversationPayload,
): Promise<Conversation> {
  const { data } = await apiClient.post<Conversation>('/conversations', payload)
  return data
}

/**
 * POST /conversations/:id/messages — Envoyer un message dans une conversation.
 * Contact actif requis (sauf thread d'incident) — vérifié à chaque envoi, pas
 * seulement à la création de la conversation.
 */
export async function sendMessage(
  conversationId: string,
  payload: SendMessagePayload,
): Promise<Message> {
  const { data } = await apiClient.post<Message>(
    `/conversations/${conversationId}/messages`,
    payload,
  )
  return data
}

// ─── Messages ─────────────────────────────────────────────────────────────────

/**
 * GET /messages/conversation/:id — Messages d'une conversation
 */
export async function fetchConversationMessages(conversationId: string): Promise<Message[]> {
  const { data } = await apiClient.get<Message[]>(`/messages/conversation/${conversationId}`)
  return Array.isArray(data) ? data : []
}

/**
 * PATCH /messages/:id/read — Marquer un message comme lu
 */
export async function markMessageAsRead(messageId: string): Promise<void> {
  await apiClient.patch(`/messages/${messageId}/read`)
}

// ─── Incidents ────────────────────────────────────────────────────────────────

/**
 * GET /incidents — Lister les incidents
 */
export async function fetchIncidents(): Promise<Incident[]> {
  const { data } = await apiClient.get<Incident[]>('/incidents')
  return data
}

/**
 * POST /incidents — Créer un incident
 */
export async function createIncident(payload: CreateIncidentPayload): Promise<Incident> {
  const { data } = await apiClient.post<Incident>('/incidents', payload)
  return data
}

/**
 * GET /incidents/:id — Détail d'un incident
 */
export async function fetchIncident(incidentId: string): Promise<Incident> {
  const { data } = await apiClient.get<Incident>(`/incidents/${incidentId}`)
  return data
}

/**
 * PUT /incidents/:id/status — Changer le statut d'un incident
 */
export async function updateIncidentStatus(
  incidentId: string,
  payload: UpdateIncidentStatusPayload,
): Promise<Incident> {
  const { data } = await apiClient.put<Incident>(`/incidents/${incidentId}/status`, payload)
  return data
}

// ─── Délégations ──────────────────────────────────────────────────────────────
// Écart signalé : /delegations n'est documenté dans aucune section de docs/routes.md.
// Comportement runtime préservé tel quel (voir en-tête de fichier).

/**
 * GET /delegations — Lister les délégations
 * Retourne la forme brute de la réponse : le backend peut répondre un tableau ou une
 * enveloppe `{ data: [...] }` — la normalisation reste à la charge de l'appelant, qui
 * reproduit le comportement historique de DelegationsPage.
 */
export async function fetchDelegations(): Promise<Delegation[] | { data: Delegation[] }> {
  const { data } = await apiClient.get<Delegation[] | { data: Delegation[] }>('/delegations')
  return data
}

/**
 * POST /delegations — Créer une demande de délégation
 */
export async function createDelegation(payload: CreateDelegationPayload): Promise<void> {
  await apiClient.post('/delegations', payload)
}
