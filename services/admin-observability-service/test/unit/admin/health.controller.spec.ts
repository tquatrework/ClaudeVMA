import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../../../src/health/health.controller';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    healthController = moduleRef.get<HealthController>(HealthController);
  });

  describe('check()', () => {
    it('retourne status ok', () => {
      const result = healthController.check();
      expect(result.status).toBe('ok');
    });

    it('retourne le nom du service correct', () => {
      const result = healthController.check();
      expect(result.service).toBe('admin-observability-service');
    });

    it('retourne un timestamp ISO 8601', () => {
      const result = healthController.check();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('retourne un objet avec les trois champs attendus', () => {
      const result = healthController.check();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('service');
      expect(result).toHaveProperty('timestamp');
    });

    it('le timestamp est proche de maintenant', () => {
      const before = Date.now();
      const result = healthController.check();
      const after = Date.now();
      const ts = new Date(result.timestamp).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });
});
