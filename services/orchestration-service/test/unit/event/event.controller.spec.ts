import { Test, TestingModule } from '@nestjs/testing';
import { EventController } from '../../../src/event/event.controller';
import { EventService } from '../../../src/event/event.service';
import { EventDirection } from '../../../src/event/entities/integration-event.entity';
import { JwtAuthGuard } from '../../../src/security/jwt-auth.guard';

const makeEventServiceMock = () => ({
  findByCorrelation: jest.fn(),
});

describe('EventController', () => {
  let controller: EventController;
  let eventService: ReturnType<typeof makeEventServiceMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventController],
      providers: [{ provide: EventService, useFactory: makeEventServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(EventController);
    eventService = module.get(EventService);
  });

  describe('findByCorrelation — GET /events/:correlationId', () => {
    it('returns chronological events for a correlationId with count (ORCH-EVT-004)', async () => {
      const correlationId = 'corr-events-1';
      const events = [
        { id: 'e1', eventType: 'WorkflowStarted', correlationId, direction: EventDirection.PUBLISHED, occurredAt: new Date('2024-01-01T10:00:00Z') },
        { id: 'e2', eventType: 'WorkflowStepCompleted', correlationId, direction: EventDirection.PUBLISHED, occurredAt: new Date('2024-01-01T10:01:00Z') },
        { id: 'e3', eventType: 'WorkflowCompleted', correlationId, direction: EventDirection.PUBLISHED, occurredAt: new Date('2024-01-01T10:02:00Z') },
      ];
      eventService.findByCorrelation.mockResolvedValue(events);

      const result = await controller.findByCorrelation(correlationId);

      expect(eventService.findByCorrelation).toHaveBeenCalledWith(correlationId);
      expect(result.correlationId).toBe(correlationId);
      expect(result.count).toBe(3);
      expect(result.events).toEqual(events);
    });

    it('returns empty list and count 0 when no events match', async () => {
      const correlationId = 'corr-no-events';
      eventService.findByCorrelation.mockResolvedValue([]);

      const result = await controller.findByCorrelation(correlationId);

      expect(result.correlationId).toBe(correlationId);
      expect(result.count).toBe(0);
      expect(result.events).toEqual([]);
    });

    it('returns CONSUMED events alongside PUBLISHED events', async () => {
      const correlationId = 'corr-mixed';
      const events = [
        { id: 'e4', eventType: 'AccountCreated', correlationId, direction: EventDirection.CONSUMED, occurredAt: new Date() },
        { id: 'e5', eventType: 'WorkflowStarted', correlationId, direction: EventDirection.PUBLISHED, occurredAt: new Date() },
      ];
      eventService.findByCorrelation.mockResolvedValue(events);

      const result = await controller.findByCorrelation(correlationId);

      expect(result.count).toBe(2);
      const directions = result.events.map((eventItem) => eventItem.direction);
      expect(directions).toContain(EventDirection.CONSUMED);
      expect(directions).toContain(EventDirection.PUBLISHED);
    });
  });
});
