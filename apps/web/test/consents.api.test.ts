/**
 * Tests unitaires — routes de consentement de src/api/accounts.ts
 *
 * Vérifie que les URL appelées sont **exactement** les chemins documentés dans
 * docs/routes.md (identity-access-service), et non des chemins calqués sur la
 * route React `/consents` de l'application.
 *
 * Couverture :
 * - fetchConsents()   → GET  /consents
 * - grantConsent()    → POST /consents            (octroi et ré-acceptation)
 * - withdrawConsent() → POST /consents/:consentType/withdraw, sans corps
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/api/client')

import apiClient from '../src/api/client'
import { fetchConsents, grantConsent, withdrawConsent } from '../src/api/accounts'
import type { ConsentEvent, ConsentState } from '../src/types/accounts'

const mockedApiClient = vi.mocked(apiClient, true)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchConsents', () => {
  it('appelle GET /consents et renvoie l’état courant des trois types', async () => {
    const consentStates: ConsentState[] = [
      {
        consentType: 'marketing',
        status: 'withdrawn',
        isGranted: false,
        isMandatory: false,
        isWithdrawable: true,
        version: '1.0',
        grantedAt: '2026-08-09T11:26:44.957Z',
        withdrawnAt: '2026-08-09T11:26:45.660Z',
        updatedAt: '2026-08-09T11:26:45.660Z',
      },
    ]
    mockedApiClient.get.mockResolvedValue({ data: consentStates })

    const result = await fetchConsents()

    expect(mockedApiClient.get).toHaveBeenCalledWith('/consents')
    expect(result).toEqual(consentStates)
  })
})

describe('grantConsent', () => {
  it('appelle POST /consents avec le type de consentement', async () => {
    mockedApiClient.post.mockResolvedValue({ data: {} })

    await grantConsent('marketing')

    expect(mockedApiClient.post).toHaveBeenCalledWith('/consents', { consentType: 'marketing' })
  })
})

describe('withdrawConsent', () => {
  it('appelle POST /consents/:consentType/withdraw sans corps et renvoie l’événement', async () => {
    const withdrawalEvent: ConsentEvent = {
      id: 'event-1',
      consentType: 'marketing',
      action: 'withdrawn',
      version: '1.0',
      recordedAt: '2026-08-09T11:26:45.660Z',
    }
    mockedApiClient.post.mockResolvedValue({ data: withdrawalEvent })

    const result = await withdrawConsent('marketing')

    expect(mockedApiClient.post).toHaveBeenCalledWith('/consents/marketing/withdraw')
    expect(result).toEqual(withdrawalEvent)
  })
})
