import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';

import { ProfileServiceClient } from '../../src/teacher-request/clients/profile-service.client';

const PROFILE_BASE_URL = 'http://profile-service:3002';
const INTERNAL_SECRET = 'internal-secret';

describe('ProfileServiceClient', () => {
  const originalFetch = global.fetch;
  let client: ProfileServiceClient;

  const buildConfigService = (): ConfigService =>
    ({
      getOrThrow: (key: string) => (key === 'PROFILE_SERVICE_URL' ? PROFILE_BASE_URL : INTERNAL_SECRET),
    }) as unknown as ConfigService;

  beforeEach(() => {
    client = new ProfileServiceClient(buildConfigService());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('resolveDisplayName', () => {
    it('lit le nom sur la route interne, sans jeton d\'appelant', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ firstName: 'Alice', lastName: 'Dupont' }),
      }) as unknown as typeof fetch;

      const displayName = await client.resolveDisplayName('student-1', { correlationId: 'corr-42' });

      expect(displayName).toBe('Alice Dupont');
      expect(global.fetch).toHaveBeenCalledWith(
        `${PROFILE_BASE_URL}/internal/profiles/student-1/display-name`,
        expect.objectContaining({
          headers: { 'X-Internal-Secret': INTERNAL_SECRET, 'x-correlation-id': 'corr-42' },
        }),
      );
    });

    it("retombe sur la route publique avec le jeton de l'appelant, et lit le bloc administrative", async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ administrative: { firstName: 'Bob', lastName: 'Martin' } }),
        });
      global.fetch = fetchMock as unknown as typeof fetch;

      const displayName = await client.resolveDisplayName('teacher-1', {
        callerAuthorization: 'Bearer jeton',
      });

      expect(displayName).toBe('Bob Martin');
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${PROFILE_BASE_URL}/profiles/teacher-1`,
        expect.objectContaining({ headers: { authorization: 'Bearer jeton' } }),
      );
    });

    it("renvoie null quand la reponse publique n'a pas de bloc administrative", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ administrative: null }) }) as unknown as typeof fetch;

      await expect(
        client.resolveDisplayName('teacher-1', { callerAuthorization: 'Bearer jeton' }),
      ).resolves.toBeNull();
    });

    it('renvoie null sans jamais lever quand le reseau tombe', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

      await expect(client.resolveDisplayName('student-1')).resolves.toBeNull();
    });

    it("n'appelle pas la route publique en l'absence de jeton d'appelant", async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 404 });
      global.fetch = fetchMock as unknown as typeof fetch;

      await expect(client.resolveDisplayName('student-1')).resolves.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRelations', () => {
    it('interroge la route interne avec le role du lecteur', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            viewerId: 'parent-1',
            targetId: 'student-1',
            isSelf: false,
            isAdministrator: false,
            relations: [{ kind: 'finance_owner_of_student' }],
          }),
      }) as unknown as typeof fetch;

      const relationLookup = await client.getRelations('parent-1', 'student-1', 'parent_financeur');

      expect(relationLookup.relations).toEqual([{ kind: 'finance_owner_of_student' }]);
      expect(global.fetch).toHaveBeenCalledWith(
        `${PROFILE_BASE_URL}/internal/relations/parent-1/student-1?viewerRole=parent_financeur`,
        expect.objectContaining({ headers: { 'X-Internal-Secret': INTERNAL_SECRET } }),
      );
    });

    it('refuse plutot que de laisser passer quand profile-service repond en erreur', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

      await expect(client.getRelations('parent-1', 'student-1', 'parent_financeur')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('refuse plutot que de laisser passer quand le reseau tombe', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('timeout')) as unknown as typeof fetch;

      await expect(client.getRelations('parent-1', 'student-1', 'parent_financeur')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('createTeacherStudentRelation', () => {
    const link = { teacherId: 'teacher-1', studentId: 'student-1', isPrincipalTeacher: true };

    it('poste le lien sur la route interne', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201 }) as unknown as typeof fetch;

      await client.createTeacherStudentRelation(link, { correlationId: 'corr-7' });

      expect(global.fetch).toHaveBeenCalledWith(
        `${PROFILE_BASE_URL}/internal/create-teacher-student-relation`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(link),
          headers: expect.objectContaining({ 'X-Internal-Secret': INTERNAL_SECRET, 'x-correlation-id': 'corr-7' }),
        }),
      );
    });

    it('traite le 409 comme un succes : le lien demande existe', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 409 }) as unknown as typeof fetch;

      await expect(client.createTeacherStudentRelation(link)).resolves.toBeUndefined();
    });

    it('leve quand la creation du lien est refusee', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch;

      await expect(client.createTeacherStudentRelation(link)).rejects.toThrow(ServiceUnavailableException);
    });

    it('leve quand le reseau tombe', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

      await expect(client.createTeacherStudentRelation(link)).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
