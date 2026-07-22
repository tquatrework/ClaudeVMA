import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Typed adapter for interservice calls to dashboard-notification-service
 * (services-convention: "les appels interservices passent par des
 * clients/adaptateurs typés avec timeout, correlation ID, politique
 * d'erreur et idempotence").
 *
 * Notifications are best-effort by design (a failed notification must never
 * fail the business operation that triggered it) — errors are logged and
 * swallowed here, never thrown. A timeout is enforced so that an
 * unresponsive dashboard-notification-service cannot hang the caller.
 */
@Injectable()
export class DashboardNotificationClient {
  private readonly logger = new Logger(DashboardNotificationClient.name);

  constructor(private readonly configService: ConfigService) {}

  async notify(userId: string, message: string, correlationId?: string): Promise<void> {
    const dashboardServiceUrl = this.configService.get<string>('DASHBOARD_NOTIFICATION_SERVICE_URL');
    if (!dashboardServiceUrl) {
      this.logger.warn('DASHBOARD_NOTIFICATION_SERVICE_URL not set — skipping notification');
      return;
    }

    try {
      await fetch(`${dashboardServiceUrl}/internal/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
        },
        body: JSON.stringify({ userId, message }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (notificationError) {
      this.logger.warn(
        `Failed to notify user ${userId} via dashboard-notification-service: ${(notificationError as Error).message}`,
      );
    }
  }
}
