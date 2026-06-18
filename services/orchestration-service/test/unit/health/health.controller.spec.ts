import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../../../src/health/health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get(HealthController);
  });

  describe('check — GET /health', () => {
    it('returns status ok and service name (contrat technique /health)', () => {
      const result = controller.check();

      expect(result.status).toBe('ok');
      expect(result.service).toBe('orchestration-service');
    });
  });
});
