import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ContactService } from '../../../src/contact/contact.service';
import { ContactPolicy } from '../../../src/contact/entities/contact-policy.entity';

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
    save: jest.fn((entity) => Promise.resolve(entity)),
    create: jest.fn((entity) => entity),
  };
}

describe('ContactService', () => {
  let service: ContactService;
  let repository: MockRepository;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    repository = makeMockRepository();
    dataSource = {
      transaction: jest.fn(async (callback: (manager: unknown) => unknown) =>
        callback({ getRepository: () => repository }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: getRepositoryToken(ContactPolicy), useValue: repository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(ContactService);
  });

  describe('findUnauthorizedContacts (COM-FB-002 — évite le N+1)', () => {
    it('retourne un tableau vide sans requête si contactIds est vide', async () => {
      const result = await service.findUnauthorizedContacts('user-1', []);
      expect(result).toEqual([]);
      expect(repository.find).not.toHaveBeenCalled();
    });

    it('retourne les contacts non autorisés en une seule requête batch', async () => {
      repository.find.mockResolvedValue([
        { contactId: 'contact-authorized', expiresAt: null },
      ]);

      const result = await service.findUnauthorizedContacts('user-1', [
        'contact-authorized',
        'contact-missing',
      ]);

      expect(repository.find).toHaveBeenCalledTimes(1);
      expect(result).toEqual(['contact-missing']);
    });

    it('traite un contact expiré comme non autorisé', async () => {
      const past = new Date(Date.now() - 1000 * 60 * 60);
      repository.find.mockResolvedValue([{ contactId: 'contact-expired', expiresAt: past }]);

      const result = await service.findUnauthorizedContacts('user-1', ['contact-expired']);

      expect(result).toEqual(['contact-expired']);
    });
  });

  describe('activateContact', () => {
    it('active un precontact existant', async () => {
      const actor = { id: 'user-1' } as any;
      repository.findOne.mockResolvedValue({
        id: 'contact-1',
        userId: 'user-1',
        status: 'precontact',
        active: false,
      });

      const result = await service.activateContact(actor, 'contact-1');

      expect(result.status).toBe('active');
      expect(result.active).toBe(true);
      expect(repository.save).toHaveBeenCalled();
    });

    it("échoue avec NotFoundException si le contact n'appartient pas à l'acteur", async () => {
      const actor = { id: 'user-1' } as any;
      repository.findOne.mockResolvedValue(null);

      await expect(service.activateContact(actor, 'contact-unknown')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('removeContact', () => {
    it('retire un contact non obligatoire', async () => {
      const actor = { id: 'user-1' } as any;
      repository.findOne.mockResolvedValue({
        id: 'contact-1',
        userId: 'user-1',
        mandatory: false,
        active: true,
      });

      await service.removeContact(actor, 'contact-1');

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
    });

    it('refuse de retirer un contact obligatoire (COM-BR-010)', async () => {
      const actor = { id: 'user-1' } as any;
      repository.findOne.mockResolvedValue({
        id: 'contact-1',
        userId: 'user-1',
        mandatory: true,
        active: true,
      });

      await expect(service.removeContact(actor, 'contact-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('échoue avec NotFoundException si le contact est introuvable', async () => {
      const actor = { id: 'user-1' } as any;
      repository.findOne.mockResolvedValue(null);

      await expect(service.removeContact(actor, 'contact-unknown')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('syncContacts', () => {
    it('exécute la synchronisation dans une transaction unique', async () => {
      repository.findOne.mockResolvedValue(null);

      await service.syncContacts({
        userId: 'user-1',
        contacts: [{ contactId: 'contact-1' }, { contactId: 'contact-2' }],
      } as any);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledTimes(2);
    });
  });
});
