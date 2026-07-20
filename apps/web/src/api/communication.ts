/**
 * Module API — communication-service (Phase 8)
 * Contacts autorisés, messagerie (conversations/messages), incidents et délégations.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Écart signalé (non documenté dans docs/routes.md — comportement runtime préservé tel
 * quel, ne pas corriger ici) :
 * - GET/POST /delegations n'apparaissent dans aucune section de docs/routes.md (ni
 *   communication-service, ni ailleurs). Route utilisée par DelegationsPage avant cette
 *   migration ; reproduite à l'identique.
 */

import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContactStatus = 'active' | 'precontact'
export type ContactVisibility = 'visible' | 'hidden'

export interface Contact {
  id: string
  userId: string
  email?: string
  displayName?: string
  role?: string
  status: ContactStatus
  mandatory: boolean
  visibility?: ContactVisibility
}

export interface UpdateVisibilityPayload {
  visibility: ContactVisibility
}

export interface Conversation {
  id: string
  participantId?: string
  participantEmail?: string
  lastMessage?: string
  unreadCount: number
}

export interface Message {
  id: string
  senderId: string
  content: string
  read: boolean
  createdAt: string
}

export interface CreateConversationPayload {
  participantId: string
}

export interface SendMessagePayload {
  content: string
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

// ─── Contacts ─────────────────────────────────────────────────────────────────

/**
 * GET /contacts — Lister les contacts autorisés (obligatoires + précontacts)
 */
export async function fetchContacts(): Promise<Contact[]> {
  const { data } = await apiClient.get<Contact[]>('/contacts')
  return data
}

/**
 * POST /contacts/:id/activate — Activer un précontact
 */
export async function activateContact(contactId: string): Promise<Contact> {
  const { data } = await apiClient.post<Contact>(`/contacts/${contactId}/activate`)
  return data
}

/**
 * DELETE /contacts/:id — Supprimer un contact actif (non obligatoire uniquement)
 */
export async function deleteContact(contactId: string): Promise<void> {
  await apiClient.delete(`/contacts/${contactId}`)
}

/**
 * PATCH /contacts/:id/visibility — Mettre à jour la visibilité d'un contact
 */
export async function updateContactVisibility(
  contactId: string,
  payload: UpdateVisibilityPayload,
): Promise<Contact> {
  const { data } = await apiClient.patch<Contact>(`/contacts/${contactId}/visibility`, payload)
  return data
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
 * POST /conversations — Créer une conversation
 */
export async function createConversation(
  payload: CreateConversationPayload,
): Promise<Conversation> {
  const { data } = await apiClient.post<Conversation>('/conversations', payload)
  return data
}

/**
 * POST /conversations/:id/messages — Envoyer un message dans une conversation
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
