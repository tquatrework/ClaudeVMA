import { Test, TestingModule } from '@nestjs/testing';
import { CommandController } from '../../../src/command/command.controller';
import { CommandService } from '../../../src/command/command.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';

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
    it('delegates to CommandService.dispatch and returns the result (ORCH-CMD-001)', async () => {
      const dto = {
        idempotencyKey: 'cmd-ctrl-1',
        targetService: 'profile-service',
        action: 'create-student-profiles',
        payload: { accountId: 'acc-1' },
      };
      const expectedResult = {
        id: 'cmd-1',
        dispatched: true,
        idempotencyKey: 'cmd-ctrl-1',
        result: { profileId: 'p-1' },
        error: null,
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
        dispatched: false,
        idempotencyKey: 'cmd-ctrl-fail',
        result: null,
        error: 'Service unavailable',
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
        dispatched: true,
        idempotencyKey: 'cmd-cached',
        result: { accountId: 'acc-existing' },
        error: null,
      };
      commandService.dispatch.mockResolvedValue(cachedResult);

      const result = await controller.dispatch(dto);

      expect(commandService.dispatch).toHaveBeenCalledTimes(1);
      expect(result).toEqual(cachedResult);
    });
  });
});
