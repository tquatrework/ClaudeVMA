import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Client sortant vers dashboard-notification-service, `POST /internal/notify`
 * (docs/routes.md, "API interne" de dashboard-notification-service).
 * `{targetUserId?, targetRole?, type, title, message, metadata?}`, protégé par
 * `X-Internal-Secret`. Utilisé ici par EmptyEntryReminderService pour rappeler
 * au formateur une entrée auto-créée restée vide plus de 24h après la séance.
 */
@Injectable()
export class DashboardNotificationClient {
  private readonly logger = new Logger(DashboardNotificationClient.name);

  constructor(private readonly config: ConfigService) {}

  async notifyUser(
    targetUserId: string,
    type: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const baseUrl = this.config.get<string>('DASHBOARD_NOTIFICATION_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('DASHBOARD_NOTIFICATION_SERVICE_URL not configured');
    }

    const response = await fetch(`${baseUrl}/internal/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': this.config.get<string>('INTERNAL_SECRET') ?? '',
      },
      body: JSON.stringify({ targetUserId, type, title, message, metadata }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`dashboard-notification-service responded ${response.status}: ${body}`);
      throw new Error(`dashboard-notification-service responded ${response.status}`);
    }
  }
}
