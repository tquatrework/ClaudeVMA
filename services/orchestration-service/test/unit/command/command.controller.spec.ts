import { Test, TestingModule } from '@nestjs/testing';
import { CommandController } from '../../../src/command/command.controller';
import { CommandService } from '../../../src/command/command.service';
import { JwtAuthGuard } from '../../../src/security/jwt-auth.guard';

const makeCommandServiceMock = () => ({
  dispatch: jest.fn(),
});

describe('CommandController', () => {
  let controller: CommandController;
  let commandService: ReturnType<typeof makeCommandServiceMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommandController],
      providers: [{ provide: CommandService, useFactory: makeCommandServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CommandController);
    commandService = module.get(CommandService);
  });

  describe('dispatch — POST /commands', () => {
    it('delegates to CommandService.dispatch and returns the mapped result (ORCH-CMD-001)', async () => {
      const dto = {
        idempotencyKey: 'cmd-ctrl-1',
        targetService: 'profile-service',
        action: 'create-student-profiles',
        payload: { accountId: 'acc-1' },
      };
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const dispatchedAt = new Date('2024-01-01T00:00:01Z');
      const expectedResult = {
        id: 'cmd-1',
        targetService: 'profile-service',
        action: 'create-student-profiles',
        idempotencyKey: 'cmd-ctrl-1',
        correlationId: 'corr-cmd-1',
        dispatched: true,
        result: { profileId: 'p-1' },
        error: null,
        createdAt,
        dispatchedAt,
      };
      commandService.dispatch.mockResolvedValue(expectedResult);

      const result = await controller.dispatch(dto);

      expect(commandService.dispatch).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });

    it('passes dispatch failure through from CommandService (ORCH-CMD-002)', async () => {
      const dto = {
        idempotencyKey: 'cmd-ctrl-fail',
        targetService: 'profile-service',
        action: 'create-student-profiles',
        payload: {},
      };
      const failureResult = {
        id: 'cmd-2',
        targetService: 'profile-service',
        action: 'create-student-profiles',
        idempotencyKey: 'cmd-ctrl-fail',
        correlationId: 'corr-cmd-2',
        dispatched: false,
        result: null,
        error: 'Service unavailable',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        dispatchedAt: new Date('2024-01-01T00:00:01Z'),
      };
      commandService.dispatch.mockResolvedValue(failureResult);

      const result = await controller.dispatch(dto);

      expect(result.dispatched).toBe(false);
      expect(result.error).toBe('Service unavailable');
    });

    it('returns cached command when idempotency key already exists (ORCH-CMD-003)', async () => {
      const dto = {
        idempotencyKey: 'cmd-cached',
        targetService: 'identity-access-service',
        action: 'create-account',
        payload: { email: 'a@b.com' },
      };
      const cachedResult = {
        id: 'cmd-existing',
        targetService: 'identity-access-service',
        action: 'create-account',
        idempotencyKey: 'cmd-cached',
        correlationId: 'corr-cmd-existing',
        dispatched: true,
        result: { accountId: 'acc-existing' },
        error: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        dispatchedAt: new Date('2024-01-01T00:00:01Z'),
      };
      commandService.dispatch.mockResolvedValue(cachedResult);

      const result = await controller.dispatch(dto);

      expect(commandService.dispatch).toHaveBeenCalledTimes(1);
      expect(result).toEqual(cachedResult);
    });
  });
});
