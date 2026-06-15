import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

const SERVICE_URL_KEYS: Record<string, string> = {
  'identity-access-service': 'IDENTITY_ACCESS_SERVICE_URL',
  'profile-service': 'PROFILE_SERVICE_URL',
  'teacher-request-service': 'TEACHER_REQUEST_SERVICE_URL',
  'calendar-service': 'CALENDAR_SERVICE_URL',
  'video-session-service': 'VIDEO_SESSION_SERVICE_URL',
  'dashboard-notification-service': 'DASHBOARD_NOTIFICATION_SERVICE_URL',
  'communication-service': 'COMMUNICATION_SERVICE_URL',
  'pedagogical-log-service': 'PEDAGOGICAL_LOG_SERVICE_URL',
  'finance-credit-service': 'FINANCE_CREDIT_SERVICE_URL',
  'legal-document-service': 'LEGAL_DOCUMENT_SERVICE_URL',
};

export interface ServiceCallOptions {
  service: string;
  action: string;
  payload: Record<string, any>;
  correlationId: string;
  idempotencyKey?: string;
}

export interface ServiceCallResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  statusCode?: number;
}

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async call(options: ServiceCallOptions): Promise<ServiceCallResult> {
    const { service, action, payload, correlationId, idempotencyKey } = options;
    const envKey = SERVICE_URL_KEYS[service];
    const baseUrl = envKey ? this.config.get<string>(envKey) : null;

    if (!baseUrl) {
      this.logger.warn(`No URL configured for ${service} — step will be skipped in non-prod`);
      return { success: true, data: { skipped: true, reason: 'service-not-configured' } };
    }

    const internalSecret = this.config.get<string>('INTERNAL_SECRET');
    const headers: Record<string, string> = {
      'x-correlation-id': correlationId,
      'content-type': 'application/json',
    };
    if (idempotencyKey) headers['x-idempotency-key'] = idempotencyKey;
    if (internalSecret) headers['x-internal-secret'] = internalSecret;

    try {
      const response = await firstValueFrom(
        this.http.post(`${baseUrl}/internal/${action}`, payload, { headers }),
      );
      return { success: true, data: response.data, statusCode: response.status };
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message ?? err?.message ?? 'unknown error';
      this.logger.error(`[${service}/${action}] HTTP ${status ?? 'ERR'}: ${message}`);
      return { success: false, error: message, statusCode: status };
    }
  }

  buildStepIdempotencyKey(workflowInstanceId: string, stepOrder: number): string {
    return `wf:${workflowInstanceId}:step:${stepOrder}`;
  }
}
