import { Test, TestingModule } from '@nestjs/testing';
import { CalendarVisibilityGrantsController } from '../../../src/calendar-events/calendar-visibility-grants.controller';
import { CalendarEventsService } from '../../../src/calendar-events/calendar-events.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { AuthenticatedUser } from '../../../src/common/interfaces/authenticated-user.interface';
import { CreateVisibilityGrantDto } from '../../../src/calendar-events/dto/create-visibility-grant.dto';

const mockCalendarEventsService = {
  createVisibilityGrant: jest.fn(),
  revokeVisibilityGrant: jest.fn(),
};

describe('CalendarVisibilityGrantsController', () => {
  let controller: CalendarVisibilityGrantsController;

  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      controllers: [CalendarVisibilityGrantsController],
      providers: [
        { provide: CalendarEventsService, useValue: mockCalendarEventsService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = testingModule.get<CalendarVisibilityGrantsController>(CalendarVisibilityGrantsController);
    jest.clearAllMocks();
  });

  describe('createVisibilityGrant', () => {
    const actor: AuthenticatedUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };
    const createVisibilityGrantDto: CreateVisibilityGrantDto = { granteeId: 'grantee-1' };
    const createdGrant = { id: 'grant-1', ownerId: 'owner-1', granteeId: 'grantee-1', grantedBy: 'rp-1' };

    it('calls service.createVisibilityGrant with correct arguments and returns the result', async () => {
      mockCalendarEventsService.createVisibilityGrant.mockResolvedValue(createdGrant);

      const result = await controller.createVisibilityGrant('owner-1', createVisibilityGrantDto, actor, undefined);

      expect(mockCalendarEventsService.createVisibilityGrant).toHaveBeenCalledWith(
        'owner-1',
        createVisibilityGrantDto,
        actor,
        undefined,
      );
      expect(result).toEqual(createdGrant);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-grant-001';
      mockCalendarEventsService.createVisibilityGrant.mockResolvedValue(createdGrant);

      await controller.createVisibilityGrant('owner-1', createVisibilityGrantDto, actor, correlationId);

      expect(mockCalendarEventsService.createVisibilityGrant).toHaveBeenCalledWith(
        'owner-1',
        createVisibilityGrantDto,
        actor,
        correlationId,
      );
    });

    it('extracts actor.id and actor.role from the current user', async () => {
      const anotherRpActor: AuthenticatedUser = { id: 'rp-2', role: UserRole.RESPONSABLE_PEDAGOGIQUE };
      mockCalendarEventsService.createVisibilityGrant.mockResolvedValue({ id: 'grant-2' });

      await controller.createVisibilityGrant('owner-2', createVisibilityGrantDto, anotherRpActor, undefined);

      expect(mockCalendarEventsService.createVisibilityGrant).toHaveBeenCalledWith(
        'owner-2',
        createVisibilityGrantDto,
        anotherRpActor,
        undefined,
      );
    });
  });

  describe('revokeVisibilityGrant', () => {
    const actor: AuthenticatedUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };
    const revokeResult = { revoked: true };

    it('calls service.revokeVisibilityGrant with correct arguments and returns the result', async () => {
      mockCalendarEventsService.revokeVisibilityGrant.mockResolvedValue(revokeResult);

      const result = await controller.revokeVisibilityGrant('owner-1', 'grantee-1', actor, undefined);

      expect(mockCalendarEventsService.revokeVisibilityGrant).toHaveBeenCalledWith(
        'owner-1',
        'grantee-1',
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        undefined,
      );
      expect(result).toEqual(revokeResult);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-revoke-001';
      mockCalendarEventsService.revokeVisibilityGrant.mockResolvedValue(revokeResult);

      await controller.revokeVisibilityGrant('owner-1', 'grantee-1', actor, correlationId);

      expect(mockCalendarEventsService.revokeVisibilityGrant).toHaveBeenCalledWith(
        'owner-1',
        'grantee-1',
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        correlationId,
      );
    });

    it('extracts actor.role from the current user', async () => {
      const anotherRpActor: AuthenticatedUser = { id: 'rp-99', role: UserRole.RESPONSABLE_PEDAGOGIQUE };
      mockCalendarEventsService.revokeVisibilityGrant.mockResolvedValue(revokeResult);

      await controller.revokeVisibilityGrant('owner-3', 'grantee-3', anotherRpActor, undefined);

      expect(mockCalendarEventsService.revokeVisibilityGrant).toHaveBeenCalledWith(
        'owner-3',
        'grantee-3',
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        undefined,
      );
    });
  });
});
