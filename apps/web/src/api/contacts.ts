/**
 * Module API — Contacts (communication-service)
 * Refondus le 2026-09-04, voir docs/architecture/contacts-messagerie.md : le Contact
 * est désormais une entité propre à communication-service (docs/routes.md §
 * communication-service > « Contacts et messagerie — refondu le 2026-09-04 »), avec
 * un cycle de vie demande → acceptée/refusée, distincte des relations métier de
 * profile-service. Remplace entièrement l'ancien modèle ContactPolicy
 * (précontact/mandatory/visibility) — ces champs n'existent plus côté serveur.
 *
 * Extrait de `api/communication.ts` le 2026-09-05 (celui-ci dépassait 300 lignes une
 * fois la refonte Contacts ajoutée) : la messagerie (conversations/messages), les
 * incidents et les délégations restent dans `communication.ts`.
 */

import apiClient from './client'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type ContactStatus = 'active' | 'broken'
export type ContactOrigin = 'default' | 'request'
export type ContactRequestStatus = 'pending' | 'accepted' | 'declined'

/** Jamais d'UUID affiché (règle du 2026-08-09) : `firstName`/`lastName` peuvent être
 * `null` si profile-service est injoignable ou si la personne n'a pas de profil
 * administratif — l'appelant doit alors afficher un repli explicite, jamais l'UUID. */
export interface ContactDisplayName {
  firstName: string | null
  lastName: string | null
}

export interface Contact {
  id: string
  counterpartId: string
  counterpartName: ContactDisplayName | null
  status: ContactStatus
  origin: ContactOrigin
  createdAt: string
  brokenAt: string | null
}

export interface ContactRequest {
  id: string
  /** Le demandeur sur une demande entrante, la cible sur une demande sortante. */
  counterpartId: string
  counterpartName: ContactDisplayName | null
  status: ContactRequestStatus
  createdAt: string
  respondedAt: string | null
}

export interface ContactSearchResult {
  userId: string
  firstName: string | null
  lastName: string | null
  /** Jamais masquable (arbitrages du 2026-08-09 et du 2026-08-17) — sert à
   * désambiguïser des homonymes avant l'envoi d'une demande. */
  loginIdentifier: string | null
}

export interface LoginIdentifierSearchResponse {
  found: boolean
  result: ContactSearchResult | null
}

export interface NameSearchResponse {
  results: ContactSearchResult[]
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

/**
 * GET /contacts — Lister mes contacts ACTIFS (créés par défaut ou acceptés).
 */
export async function fetchContacts(): Promise<Contact[]> {
  const { data } = await apiClient.get<Contact[]>('/contacts')
  return data
}

/**
 * POST /contacts/:id/break — Rompre un contact actif.
 * Acte volontaire d'une des deux parties, jamais automatique ; non destructif
 * (la ligne passe à l'état "broken", elle n'est jamais supprimée) — un contact
 * rompu peut être redemandé ensuite par le flux normal.
 */
export async function breakContact(contactId: string): Promise<Contact> {
  const { data } = await apiClient.post<Contact>(`/contacts/${contactId}/break`)
  return data
}

/**
 * GET /contacts/search/by-login-identifier?value= — Rechercher une personne par
 * identifiant de connexion exact.
 */
export async function searchContactByLoginIdentifier(
  value: string,
): Promise<LoginIdentifierSearchResponse> {
  const { data } = await apiClient.get<LoginIdentifierSearchResponse>(
    '/contacts/search/by-login-identifier',
    { params: { value } },
  )
  return data
}

/**
 * GET /contacts/search/by-name?q= — Rechercher des personnes par prénom/nom.
 * Zéro ou un seul résultat est un cas normal, pas une anomalie (tous les noms
 * ne sont pas connus).
 */
export async function searchContactByName(query: string): Promise<NameSearchResponse> {
  const { data } = await apiClient.get<NameSearchResponse>('/contacts/search/by-name', {
    params: { q: query },
  })
  return data
}

/**
 * GET /contacts/requests/incoming — Mes demandes de contact reçues, en attente.
 */
export async function fetchIncomingContactRequests(): Promise<ContactRequest[]> {
  const { data } = await apiClient.get<ContactRequest[]>('/contacts/requests/incoming')
  return data
}

/**
 * GET /contacts/requests/outgoing — Mes demandes de contact envoyées, tous statuts.
 */
export async function fetchOutgoingContactRequests(): Promise<ContactRequest[]> {
  const { data } = await apiClient.get<ContactRequest[]>('/contacts/requests/outgoing')
  return data
}

/**
 * POST /contacts/requests — Envoyer une demande de contact.
 * Aucune acceptation automatique, jamais. Peut être refusée par le serveur (403)
 * en cas de blocage (cooldown d'un mois après un refus, blocage définitif au
 * 3ᵉ refus cumulé pour cette paire dirigée) — le message métier français du
 * serveur est alors la seule source d'information, à afficher tel quel.
 */
export async function sendContactRequest(targetId: string): Promise<ContactRequest> {
  const { data } = await apiClient.post<ContactRequest>('/contacts/requests', { targetId })
  return data
}

/**
 * POST /contacts/requests/:id/accept — Accepter une demande reçue (crée le
 * contact actif).
 */
export async function acceptContactRequest(requestId: string): Promise<ContactRequest> {
  const { data } = await apiClient.post<ContactRequest>(`/contacts/requests/${requestId}/accept`)
  return data
}

/**
 * POST /contacts/requests/:id/decline — Refuser une demande reçue (journalisée
 * pour la pénalité de refus).
 */
export async function declineContactRequest(requestId: string): Promise<ContactRequest> {
  const { data } = await apiClient.post<ContactRequest>(`/contacts/requests/${requestId}/decline`)
  return data
}
