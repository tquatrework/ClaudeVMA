import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCalendarEventDto } from '../../../src/calendar-events/dto/create-calendar-event.dto';
import { EventType } from '../../../src/calendar-events/entities/calendar-event.entity';

/**
 * Regression test for the real bug reported by the user:
 * `POST /calendars/:ownerId/events` rejected the exact body sent by the
 * front-end (`{title, startAt, endAt, eventType, ...}`, per docs/routes.md)
 * with "startTime must be a valid ISO 8601 date stringendTime must be a
 * valid ISO 8601 date string", because the DTO required `startTime`/`endTime`
 * instead of the documented `startAt`/`endAt`.
 *
 * These tests exercise class-validator/class-transformer directly, the same
 * way Nest's global `ValidationPipe({ whitelist: true, transform: true })`
 * (see src/main.ts) processes an incoming request body — without spinning up
 * the full HTTP stack.
 */
describe('CreateCalendarEventDto', () => {
  const validBody = {
    title: 'Cours de géométrie',
    eventType: EventType.COURS,
    startAt: '2026-06-10T14:00:00.000Z',
    endAt: '2026-06-10T15:00:00.000Z',
  };

  it('accepts the exact body the front-end sends (startAt/endAt, ISO 8601)', async () => {
    const dto = plainToInstance(CreateCalendarEventDto, validBody);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects the legacy startTime/endTime body shape with explicit errors (no silent pass)', async () => {
    const legacyBody = {
      title: 'Cours de géométrie',
      eventType: EventType.COURS,
      startTime: '2026-06-10T14:00:00.000Z',
      endTime: '2026-06-10T15:00:00.000Z',
    };
    const dto = plainToInstance(CreateCalendarEventDto, legacyBody);
    const errors = await validate(dto);

    const errorProperties = errors.map((error) => error.property);
    expect(errorProperties).toContain('startAt');
    expect(errorProperties).toContain('endAt');
  });

  it('rejects a non-ISO startAt/endAt with a distinct error per field', async () => {
    const dto = plainToInstance(CreateCalendarEventDto, {
      ...validBody,
      startAt: 'not-a-date',
      endAt: 'also-not-a-date',
    });
    const errors = await validate(dto);

    const errorProperties = errors.map((error) => error.property);
    expect(errorProperties).toEqual(expect.arrayContaining(['startAt', 'endAt']));
  });

  it('accepts optional inviteeIds and description alongside startAt/endAt', async () => {
    const dto = plainToInstance(CreateCalendarEventDto, {
      ...validBody,
      description: 'Chapitre sur les triangles',
      inviteeIds: ['3fa1b6e0-1234-4b2b-9e9e-000000000099'],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
