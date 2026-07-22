import { Test, TestingModule } from '@nestjs/testing';
import { EventCancellationsController } from '../../../src/calendar-events/event-cancellations.controller';
import { CalendarEventsService } from '../../../src/calendar-events/calendar-events.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { AuthenticatedUser } from '../../../src/common/interfaces/authenticated-user.interface';
import { CancelRequestDto } from '../../../src/calendar-events/dto/cancel-request.dto';

const mockCalendarEventsService = {
  requestCancellation: jest.fn(),
};

describe('EventCancellationsController', () => {
  let controller: EventCancellationsController;

  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      controllers: [EventCancellationsController],
      providers: [
        { provide: CalendarEventsService, useValue: mockCalendarEventsService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = testingModule.get<EventCancellationsController>(EventCancellationsController);
    jest.clearAllMocks();
  });

  describe('requestCancellation', () => {
    const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };
    const cancelRequestDto: CancelRequestDto = { reason: 'Indisponibilité imprévue' };
    const cancellationResult = { id: 'req-1', eventId: 'evt-3', status: 'APPROVED' };

    it('calls service.requestCancellation with correct arguments and returns the result', async () => {
      mockCalendarEventsService.requestCancellation.mockResolvedValue(cancellationResult);

      const result = await controller.requestCancellation('evt-3', cancelRequestDto, actor, undefined);

      expect(mockCalendarEventsService.requestCancellation).toHaveBeenCalledWith(
        'evt-3',
        cancelRequestDto,
        'teacher-1',
        UserRole.FORMATEUR,
        undefined,
      );
      expect(result).toEqual(cancellationResult);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-cancel-001';
      mockCalendarEventsService.requestCancellation.mockResolvedValue(cancellationResult);

      await controller.requestCancellation('evt-3', cancelRequestDto, actor, correlationId);

      expect(mockCalendarEventsService.requestCancellation).toHaveBeenCalledWith(
        'evt-3',
        cancelRequestDto,
        'teacher-1',
        UserRole.FORMATEUR,
        correlationId,
      );
    });

    it('extracts actor.id and actor.role from the current user', async () => {
      const rpActor: AuthenticatedUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };
      mockCalendarEventsService.requestCancellation.mockResolvedValue(cancellationResult);

      await controller.requestCancellation('evt-3', cancelRequestDto, rpActor, undefined);

      expect(mockCalendarEventsService.requestCancellation).toHaveBeenCalledWith(
        'evt-3',
        cancelRequestDto,
        'rp-1',
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        undefined,
      );
    });
  });
});
