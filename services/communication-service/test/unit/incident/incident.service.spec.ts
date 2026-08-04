import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IncidentService } from '../../../src/incident/incident.service';
import { IncidentStatus, IncidentThread } from '../../../src/incident/entities/incident-thread.entity';
import { ConversationService } from '../../../src/conversation/conversation.service';

type MockRepository = {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
};

function makeMockRepository(): MockRepository {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((entity) => Promise.resolve({ id: 'incident-1', ...entity })),
    create: jest.fn((entity) => entity),
  };
}

describe('IncidentService', () => {
  let service: IncidentService;
  let incidentRepository: MockRepository;
  let conversationService: {
    createIncidentConversation: jest.Mock;
    setIncidentId: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let sharedManager: { getRepository: jest.Mock };

  beforeEach(async () => {
    incidentRepository = makeMockRepository();
    sharedManager = { getRepository: jest.fn(() => incidentRepository) };

    conversationService = {
      createIncidentConversation: jest.fn().mockResolvedValue({ id: 'conversation-1' }),
      setIncidentId: jest.fn().mockResolvedValue(undefined),
    };

    dataSource = {
      transaction: jest.fn(async (callback: (manager: unknown) => unknown) => callback(sharedManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentService,
        { provide: getRepositoryToken(IncidentThread), useValue: incidentRepository },
        { provide: ConversationService, useValue: conversationService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(IncidentService);
  });

  describe('create — transaction atomique (services-convention)', () => {
    const actor = { id: 'ti-1', role: 'technicien_informatique' } as any;
    const dto = { targetUserId: 'student-1', description: "L'élève ne peut plus se connecter" } as any;

    it('propage le même EntityManager à la conversation et à l\'incident', async () => {
      await service.create(dto, actor);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(conversationService.createIncidentConversation).toHaveBeenCalledWith(
        sharedManager,
        [actor.id, dto.targetUserId],
        expect.stringContaining('Incident:'),
      );
      expect(conversationService.setIncidentId).toHaveBeenCalledWith(
        sharedManager,
        'conversation-1',
        'incident-1',
      );
    });

    it('ne back-fill pas incidentId si la création de l\'incident échoue (rollback logique)', async () => {
      incidentRepository.save.mockRejectedValueOnce(new Error('db failure'));

      await expect(service.create(dto, actor)).rejects.toThrow('db failure');
      expect(conversationService.setIncidentId).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('met à jour le statut sans revérifier le rôle (délégué au guard du contrôleur)', async () => {
      incidentRepository.findOne.mockResolvedValue({ id: 'incident-1', status: IncidentStatus.OPEN });

      const result = await service.updateStatus('incident-1', { status: IncidentStatus.IN_PROGRESS } as any);

      expect(result.status).toBe(IncidentStatus.IN_PROGRESS);
      expect(incidentRepository.save).toHaveBeenCalled();
    });

    it('échoue avec NotFoundException si l\'incident est introuvable', async () => {
      incidentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('unknown', { status: IncidentStatus.CLOSED } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('retourne l\'incident trouvé', async () => {
      incidentRepository.findOne.mockResolvedValue({ id: 'incident-1' });
      const result = await service.findOne('incident-1');
      expect(result).toEqual({ id: 'incident-1' });
    });

    it('échoue avec NotFoundException si introuvable', async () => {
      incidentRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('unknown')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
