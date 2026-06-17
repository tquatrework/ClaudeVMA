/**
 * Module API — communication-service (Phase 8)
 * Gestion des contacts autorisés et de leur visibilité.
 * Toutes les requêtes passent par apiClient (base /api/v1).
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
