import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContactService } from '../../../src/contact/contact.service';
import { Contact } from '../../../src/contact/entities/contact.entity';

type MockRepository = {
  find: jest.Mock;
  findOne: jest.Mock;
  count: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function makeMockRepository(): MockRepository {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn((entity) => Promise.resolve(entity)),
    create: jest.fn((entity) => entity),
    createQueryBuilder: jest.fn(),
  };
}

describe('ContactService', () => {
  let service: ContactService;
  let repository: MockRepository;

  beforeEach(async () => {
    repository = makeMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ContactService, { provide: getRepositoryToken(Contact), useValue: repository }],
    }).compile();

    service = module.get(ContactService);
  });

  describe('canonicalPair', () => {
    it('is order-independent — same pair regardless of argument order', () => {
      expect(service.canonicalPair('user-a', 'user-b')).toEqual(service.canonicalPair('user-b', 'user-a'));
    });
  });

  describe('isActiveContact', () => {
    it('true when an active row exists for the canonical pair', async () => {
      repository.count.mockResolvedValue(1);
      await expect(service.isActiveContact('user-1', 'user-2')).resolves.toBe(true);
    });

    it('false when no active row exists', async () => {
      repository.count.mockResolvedValue(0);
      await expect(service.isActiveContact('user-1', 'user-2')).resolves.toBe(false);
    });
  });

  describe('findInactiveContacts (avoids N+1)', () => {
    it('returns an empty array without querying if otherIds is empty', async () => {
      const result = await service.findInactiveContacts('user-1', []);
      expect(result).toEqual([]);
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('returns the subset without an active contact, in a single batch query', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ userAId: 'user-1', userBId: 'contact-authorized' }]),
      };
      repository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findInactiveContacts('user-1', ['contact-authorized', 'contact-missing']);

      expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(result).toEqual(['contact-missing']);
    });
  });

  describe('ensureActiveContact', () => {
    it('is a no-op if an active row already exists for the pair', async () => {
      const existing = { id: 'contact-1', userAId: 'user-1', userBId: 'user-2', status: 'active' };
      repository.findOne.mockResolvedValue(existing);

      const result = await service.ensureActiveContact('user-1', 'user-2', 'default');

      expect(result).toBe(existing);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('creates a new active row when none exists', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.ensureActiveContact('user-1', 'user-2', 'default');

      expect(repository.save).toHaveBeenCalled();
      expect(result.status).toBe('active');
      expect(result.origin).toBe('default');
    });
  });

  describe('breakContact', () => {
    it('breaks an active contact the actor is part of', async () => {
      const actor = { id: 'user-1' } as any;
      repository.findOne.mockResolvedValue({
        id: 'contact-1',
        userAId: 'user-1',
        userBId: 'user-2',
        status: 'active',
      });

      const result = await service.breakContact(actor, 'contact-1');

      expect(result.status).toBe('broken');
      expect(result.brokenBy).toBe('user-1');
      expect(repository.save).toHaveBeenCalled();
    });

    it('is idempotent on an already-broken contact', async () => {
      const actor = { id: 'user-1' } as any;
      const broken = { id: 'contact-1', userAId: 'user-1', userBId: 'user-2', status: 'broken' };
      repository.findOne.mockResolvedValue(broken);

      const result = await service.breakContact(actor, 'contact-1');

      expect(result).toBe(broken);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException (masking, never 403) if the actor is not part of the contact', async () => {
      const actor = { id: 'user-3' } as any;
      repository.findOne.mockResolvedValue({
        id: 'contact-1',
        userAId: 'user-1',
        userBId: 'user-2',
        status: 'active',
      });

      await expect(service.breakContact(actor, 'contact-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException if the contact does not exist', async () => {
      const actor = { id: 'user-1' } as any;
      repository.findOne.mockResolvedValue(null);

      await expect(service.breakContact(actor, 'contact-unknown')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
