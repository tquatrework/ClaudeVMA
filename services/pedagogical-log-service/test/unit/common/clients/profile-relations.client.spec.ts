/**
 * Unit tests — ProfileRelationsClient
 *
 * Contrat : GET /internal/relations/:viewerId/:targetId?viewerRole=, protégé par
 * X-Internal-Secret (docs/routes.md). Politique d'échec : injoignable/erreur → 503
 * (échec fermé), relation absente → 403.
 */

import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProfileRelationsClient } from '../../../../src/common/clients/profile-relations.client';

const TEACHER_ID = 'bbbbbbbb-0000-4000-b000-bbbbbbbbbbbb';
const STUDENT_ID = 'aaaaaaaa-0000-4000-a000-aaaaaaaaaaaa';

describe('ProfileRelationsClient', () => {
  let client: ProfileRelationsClient;
  let config: { get: jest.Mock };

  beforeEach(() => {
    config = {
      get: jest.fn((key: string) => {
        if (key === 'PROFILE_SERVICE_URL') return 'http://profile-service:3002';
        if (key === 'INTERNAL_SECRET') return 'test-secret';
        return undefined;
      }),
    };
    client = new ProfileRelationsClient(config as unknown as ConfigService);
    global.fetch = jest.fn();
  });

  afterEach(() => jest.resetAllMocks());

  describe('assertTeacherOfStudent()', () => {
    it('résout sans erreur quand la relation teacher_of_student existe', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          viewerId: TEACHER_ID,
          targetId: STUDENT_ID,
          isSelf: false,
          isAdministrator: false,
          relations: [{ kind: 'teacher_of_student' }],
        }),
      });

      await expect(
        client.assertTeacherOfStudent(TEACHER_ID, STUDENT_ID),
      ).resolves.toBeUndefined();

      expect(global.fetch).toHaveBeenCalledWith(
        `http://profile-service:3002/internal/relations/${TEACHER_ID}/${STUDENT_ID}?viewerRole=formateur`,
        { headers: { 'X-Internal-Secret': 'test-secret' } },
      );
    });

    it('[CRITIQUE] relation absente → ForbiddenException (403)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ viewerId: TEACHER_ID, targetId: STUDENT_ID, isSelf: false, isAdministrator: false, relations: [] }),
      });

      await expect(
        client.assertTeacherOfStudent(TEACHER_ID, STUDENT_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[CRITIQUE] profile-service injoignable (fetch throw) → ServiceUnavailableException (503, échec fermé)', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        client.assertTeacherOfStudent(TEACHER_ID, STUDENT_ID),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('[CRITIQUE] profile-service répond en erreur (non-2xx) → ServiceUnavailableException (503)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

      await expect(
        client.assertTeacherOfStudent(TEACHER_ID, STUDENT_ID),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('PROFILE_SERVICE_URL absent → ServiceUnavailableException, sans appel réseau', async () => {
      config.get.mockImplementation((key: string) => (key === 'INTERNAL_SECRET' ? 'test-secret' : undefined));

      await expect(
        client.assertTeacherOfStudent(TEACHER_ID, STUDENT_ID),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
