import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { CallbackController } from '../../../src/callback/callback.controller';
import { EventService } from '../../../src/event/event.service';
import { EventDirection } from '../../../src/event/entities/integration-event.entity';

const makeEventServiceMock = () => ({
  record: jest.fn().mockResolvedValue({ id: 'evt-1' }),
});

const makeRequest = (body: Record<string, unknown>): Request =>
  ({ body }) as unknown as Request;

describe('CallbackController', () => {
  let controller: CallbackController;
  let eventService: ReturnType<typeof makeEventServiceMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CallbackController],
      providers: [{ provide: EventService, useFactory: makeEventServiceMock }],
    }).compile();

    controller = module.get(CallbackController);
    eventService = module.get(EventService);
  });

  describe('receive — ORCH-CB-001', () => {
    it('records a callback event with the provider body and returns received: true', async () => {
      const body = {
        correlationId: 'corr-cb-1',
        eventType: 'video.session.ended',
        sessionId: 'sess-1',
      };

      const result = await controller.receive('video-provider', body, makeRequest(body));

      expect(eventService.record).toHaveBeenCalledWith(
        'video.session.ended',
        'corr-cb-1',
        EventDirection.CONSUMED,
        body,
        'video-provider',
      );
      expect(result).toEqual({ received: true, correlationId: 'corr-cb-1' });
    });

    it('uses body.correlation_id (snake_case) as fallback for correlationId — ORCH-CB-002', async () => {
      const body = { correlation_id: 'corr-snake-1', eventType: 'payment.success' };

      const result = await controller.receive('payment-provider', body, makeRequest(body));

      expect(eventService.record).toHaveBeenCalledWith(
        'payment.success',
        'corr-snake-1',
        EventDirection.CONSUMED,
        body,
        'payment-provider',
      );
      expect(result.correlationId).toBe('corr-snake-1');
    });

    it('generates a correlationId when none is provided in the body — ORCH-CB-003', async () => {
      const body = { eventType: 'some.event' };

      const result = await controller.receive('ext-provider', body, makeRequest(body));

      expect(typeof result.correlationId).toBe('string');
      expect(result.correlationId.length).toBeGreaterThan(0);
    });

    it('uses provider name in eventType fallback when eventType is absent — ORCH-CB-004', async () => {
      const body = { correlationId: 'corr-notype' };

      await controller.receive('livekit', body, makeRequest(body));

      expect(eventService.record).toHaveBeenCalledWith(
        'livekit.callback',
        'corr-notype',
        EventDirection.CONSUMED,
        body,
        'livekit',
      );
    });

    it('uses body.event_type (snake_case) as fallback for eventType — ORCH-CB-005', async () => {
      const body = { correlationId: 'corr-snaketype', event_type: 'contract.signed' };

      await controller.receive('docusign', body, makeRequest(body));

      expect(eventService.record).toHaveBeenCalledWith(
        'contract.signed',
        'corr-snaketype',
        EventDirection.CONSUMED,
        body,
        'docusign',
      );
    });

    it('falls back to an empty raw payload when the request body is absent — ORCH-CB-006', async () => {
      const dto = { correlationId: 'corr-empty' };
      const req = {} as unknown as Request;

      await controller.receive('empty-provider', dto, req);

      expect(eventService.record).toHaveBeenCalledWith(
        'empty-provider.callback',
        'corr-empty',
        EventDirection.CONSUMED,
        {},
        'empty-provider',
      );
    });
  });
});
