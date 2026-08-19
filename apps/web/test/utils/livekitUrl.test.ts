import { describe, it, expect } from 'vitest'
import { livekitUrlToCertificateTrustUrl } from '../../src/utils/livekitUrl'

describe('livekitUrlToCertificateTrustUrl', () => {
  it('convertit wss:// en https:// en conservant hôte et port', () => {
    expect(livekitUrlToCertificateTrustUrl('wss://193.108.54.226:7880')).toBe(
      'https://193.108.54.226:7880/',
    )
  })

  it('convertit ws:// en http://', () => {
    expect(livekitUrlToCertificateTrustUrl('ws://localhost:7880')).toBe('http://localhost:7880/')
  })

  it('retourne null pour une URL absente', () => {
    expect(livekitUrlToCertificateTrustUrl(undefined)).toBeNull()
    expect(livekitUrlToCertificateTrustUrl(null)).toBeNull()
    expect(livekitUrlToCertificateTrustUrl('')).toBeNull()
  })

  it('retourne null pour un protocole non ws/wss', () => {
    expect(livekitUrlToCertificateTrustUrl('https://already-https.example.com')).toBeNull()
  })

  it('retourne null pour une chaîne non-URL', () => {
    expect(livekitUrlToCertificateTrustUrl('not a url')).toBeNull()
  })
})
