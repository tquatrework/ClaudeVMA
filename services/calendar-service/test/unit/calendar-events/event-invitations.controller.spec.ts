import { Test, TestingModule } from '@nestjs/testing';
import { EventInvitationsController } from '../../../src/calendar-events/event-invitations.controller';
import { CalendarEventsService } from '../../../src/calendar-events/calendar-events.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { AuthenticatedUser } from '../../../src/common/interfaces/authenticated-user.interface';

const mockCalendarEventsService = {
  acceptInvitation: jest.fn(),
  declineInvitation: jest.fn(),
};

describe('EventInvitationsController', () => {
  let controller: EventInvitationsController;

  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      controllers: [EventInvitationsController],
      providers: [
        { provide: CalendarEventsService, useValue: mockCalendarEventsService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = testingModule.get<EventInvitationsController>(EventInvitationsController);
    jest.clearAllMocks();
  });

  describe('acceptInvitation', () => {
    const actor: AuthenticatedUser = { id: 'invitee-1', role: UserRole.ELEVE };
    const acceptedInvitation = { id: 'inv-1', eventId: 'evt-1', inviteeId: 'invitee-1', status: 'ACCEPTED' };

    it('calls service.acceptInvitation with eventId, userId, actor and correlationId and returns the result', async () => {
      mockCalendarEventsService.acceptInvitation.mockResolvedValue(acceptedInvitation);

      const result = await controller.acceptInvitation('evt-1', 'invitee-1', actor, undefined);

      expect(mockCalendarEventsService.acceptInvitation).toHaveBeenCalledWith(
        'evt-1',
        'invitee-1',
        actor,
        undefined,
      );
      expect(result).toEqual(acceptedInvitation);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-accept-001';
      mockCalendarEventsService.acceptInvitation.mockResolvedValue(acceptedInvitation);

      await controller.acceptInvitation('evt-1', 'invitee-1', actor, correlationId);

      expect(mockCalendarEventsService.acceptInvitation).toHaveBeenCalledWith(
        'evt-1',
        'invitee-1',
        actor,
        correlationId,
      );
    });

    it('delegates ownership validation to the service (passes actor unchanged even when different from the route userId)', async () => {
      const differentActor: AuthenticatedUser = { id: 'other-user', role: UserRole.ELEVE };
      mockCalendarEventsService.acceptInvitation.mockRejectedValue(new Error('ForbiddenException'));

      await expect(
        controller.acceptInvitation('evt-1', 'invitee-1', differentActor, undefined),
      ).rejects.toThrow();

      expect(mockCalendarEventsService.acceptInvitation).toHaveBeenCalledWith(
        'evt-1',
        'invitee-1',
        differentActor,
        undefined,
      );
    });
  });

  describe('declineInvitation', () => {
    const actor: AuthenticatedUser = { id: 'invitee-2', role: UserRole.FORMATEUR };
    const declinedInvitation = { id: 'inv-2', eventId: 'evt-2', inviteeId: 'invitee-2', status: 'DECLINED' };

    it('calls service.declineInvitation with eventId, userId, actor and correlationId and returns the result', async () => {
      mockCalendarEventsService.declineInvitation.mockResolvedValue(declinedInvitation);

      const result = await controller.declineInvitation('evt-2', 'invitee-2', actor, undefined);

      expect(mockCalendarEventsService.declineInvitation).toHaveBeenCalledWith(
        'evt-2',
        'invitee-2',
        actor,
        undefined,
      );
      expect(result).toEqual(declinedInvitation);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-decline-001';
      mockCalendarEventsService.declineInvitation.mockResolvedValue(declinedInvitation);

      await controller.declineInvitation('evt-2', 'invitee-2', actor, correlationId);

      expect(mockCalendarEventsService.declineInvitation).toHaveBeenCalledWith(
        'evt-2',
        'invitee-2',
        actor,
        correlationId,
      );
    });

    it('delegates ownership validation to the service (passes actor unchanged even when different from the route userId)', async () => {
      const attackerActor: AuthenticatedUser = { id: 'attacker-user', role: UserRole.FORMATEUR };
      mockCalendarEventsService.declineInvitation.mockRejectedValue(new Error('ForbiddenException'));

      await expect(
        controller.declineInvitation('evt-2', 'invitee-2', attackerActor, undefined),
      ).rejects.toThrow();

      expect(mockCalendarEventsService.declineInvitation).toHaveBeenCalledWith(
        'evt-2',
        'invitee-2',
        attackerActor,
        undefined,
      );
    });
  });
});
