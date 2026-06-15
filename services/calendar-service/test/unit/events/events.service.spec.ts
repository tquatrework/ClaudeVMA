import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from '../../../src/events/events.service';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsService],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('publishes AvailabilityUpdated without throwing', () => {
    expect(() =>
      service.publish('AvailabilityUpdated', { ownerId: 'u1', slotCount: 3 }),
    ).not.toThrow();
  });

  it('publishes ActivityScheduled with correlationId', () => {
    expect(() =>
      service.publish('ActivityScheduled', { activityId: 'a1' }, 'corr-123'),
    ).not.toThrow();
  });

  it('publishes ActivityUpdated', () => {
    expect(() =>
      service.publish('ActivityUpdated', { activityId: 'a1', changes: ['title'] }),
    ).not.toThrow();
  });

  it('publishes ReminderCreated', () => {
    expect(() =>
      service.publish('ReminderCreated', { reminderId: 'r1', ownerId: 'u2' }),
    ).not.toThrow();
  });
});
