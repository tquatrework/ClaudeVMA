/**
 * Unit tests — validation de `resourceLinks` sur CreateLogDto (arbitrage du
 * 2026-08-26, point 1) : URL absolue http(s) obligatoire, label non vide,
 * tableau plafonné à 10 éléments.
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLogDto, MAX_RESOURCE_LINKS_PER_ENTRY } from '../../../src/pedagogical-log/dto/create-log.dto';

async function validateDto(body: Record<string, unknown>) {
  const instance = plainToInstance(CreateLogDto, body);
  return validate(instance);
}

describe('CreateLogDto.resourceLinks', () => {
  it('accepte un lien valide (label + URL https absolue)', async () => {
    const errors = await validateDto({
      resourceLinks: [{ label: 'Fiche de cours', url: 'https://example.com/fiche.pdf' }],
    });
    expect(errors).toHaveLength(0);
  });

  it('accepte une URL http:// (pas seulement https)', async () => {
    const errors = await validateDto({
      resourceLinks: [{ label: 'Ancien site', url: 'http://example.com' }],
    });
    expect(errors).toHaveLength(0);
  });

  it('resourceLinks est optionnel — absent, pas d\'erreur', async () => {
    const errors = await validateDto({ sessionSummary: 'x' });
    expect(errors).toHaveLength(0);
  });

  it('[CRITIQUE] refuse une URL relative ou sans protocole', async () => {
    const errors = await validateDto({
      resourceLinks: [{ label: 'Lien invalide', url: '/relative/path' }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('[CRITIQUE] refuse un protocole autre que http/https (ex. javascript:)', async () => {
    const errors = await validateDto({
      resourceLinks: [{ label: 'XSS', url: 'javascript:alert(1)' }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('[CRITIQUE] refuse un label vide', async () => {
    const errors = await validateDto({
      resourceLinks: [{ label: '', url: 'https://example.com' }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('[CRITIQUE] refuse un label absent', async () => {
    const errors = await validateDto({
      resourceLinks: [{ url: 'https://example.com' }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it(`[CRITIQUE] refuse un tableau de plus de ${MAX_RESOURCE_LINKS_PER_ENTRY} liens (jamais non borné)`, async () => {
    const tooMany = Array.from({ length: MAX_RESOURCE_LINKS_PER_ENTRY + 1 }, (_, i) => ({
      label: `Lien ${i}`,
      url: `https://example.com/${i}`,
    }));
    const errors = await validateDto({ resourceLinks: tooMany });
    expect(errors.length).toBeGreaterThan(0);
  });

  it(`accepte exactement ${MAX_RESOURCE_LINKS_PER_ENTRY} liens`, async () => {
    const exactly = Array.from({ length: MAX_RESOURCE_LINKS_PER_ENTRY }, (_, i) => ({
      label: `Lien ${i}`,
      url: `https://example.com/${i}`,
    }));
    const errors = await validateDto({ resourceLinks: exactly });
    expect(errors).toHaveLength(0);
  });
});
