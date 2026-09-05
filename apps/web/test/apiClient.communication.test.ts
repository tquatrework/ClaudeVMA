/**
 * Tests unitaires pour apps/web/src/api/communication.ts
 *
 * Vérifie que chaque fonction appelle la bonne route HTTP avec les bons paramètres.
 *
 * Les tests des Contacts vivent désormais dans `apiClient.contacts.test.ts`, extrait
 * le 2026-09-05 en même temps que le module source `api/contacts.ts`
 * (docs/architecture/contacts-messagerie.md, 2026-09-04) — ce fichier ne couvre plus
 * que la messagerie (conversations/messages).
 *
 * Couverture :
 * - createConversation(payload) → POST /conversations {participantIds}
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock du client axios partagé
vi.mock('../src/api/client')

import apiClient from '../src/api/client'
import { createConversation } from '../src/api/communication'

const mockApiClient = vi.mocked(apiClient)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createConversation', () => {
  it('appelle POST /conversations avec participantIds (jamais participantId seul)', async () => {
    const conversation = {
      id: 'conv-1',
      participantIds: ['self', 'user-uuid-1'],
      subject: null,
      isIncident: false,
      incidentId: null,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    }
    mockApiClient.post = vi.fn().mockResolvedValue({ data: conversation })

    const result = await createConversation({ participantIds: ['user-uuid-1'] })

    expect(mockApiClient.post).toHaveBeenCalledWith('/conversations', { participantIds: ['user-uuid-1'] })
    expect(result).toEqual(conversation)
  })
})
