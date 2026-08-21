/**
 * Unit tests — DashboardNotificationClient
 * Contrat : POST /internal/notify {targetUserId, type, title, message, metadata?},
 * protégé par X-Internal-Secret (docs/routes.md).
 */

import { ConfigService } from '@nestjs/config';
import { DashboardNotificationClient } from '../../../../src/common/clients/dashboard-notification.client';

describe('DashboardNotificationClient', () => {
  let client: DashboardNotificationClient;
  let config: { get: jest.Mock };

  beforeEach(() => {
    config = {
      get: jest.fn((key: string) => {
        if (key === 'DASHBOARD_NOTIFICATION_SERVICE_URL') return 'http://dashboard-notification-service:3003';
        if (key === 'INTERNAL_SECRET') return 'test-secret';
        return undefined;
      }),
    };
    client = new DashboardNotificationClient(config as unknown as ConfigService);
    global.fetch = jest.fn();
  });

  afterEach(() => jest.resetAllMocks());

  it('envoie POST /internal/notify avec le bon corps et le secret interne', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await client.notifyUser('user-1', 'pedagogical_log_entry_empty', 'Titre', 'Message', { a: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://dashboard-notification-service:3003/internal/notify',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Internal-Secret': 'test-secret' }),
        body: JSON.stringify({
          targetUserId: 'user-1',
          type: 'pedagogical_log_entry_empty',
          title: 'Titre',
          message: 'Message',
          metadata: { a: 1 },
        }),
      }),
    );
  });

  it('[CRITIQUE] réponse non-ok → lève une erreur (pas d\'échec silencieux)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

    await expect(
      client.notifyUser('user-1', 'type', 'Titre', 'Message'),
    ).rejects.toThrow();
  });

  it('DASHBOARD_NOTIFICATION_SERVICE_URL absent → lève sans appel réseau', async () => {
    config.get.mockImplementation((key: string) => (key === 'INTERNAL_SECRET' ? 'test-secret' : undefined));

    await expect(
      client.notifyUser('user-1', 'type', 'Titre', 'Message'),
    ).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
