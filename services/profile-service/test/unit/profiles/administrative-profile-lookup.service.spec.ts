import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdministrativeProfileLookupService } from '../../../src/profiles/administrative-profile-lookup.service';
import { AdministrativeProfile } from '../../../src/profiles/entities/administrative-profile.entity';

describe('AdministrativeProfileLookupService', () => {
  let service: AdministrativeProfileLookupService;
  let adminRepo: any;

  beforeEach(async () => {
    adminRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdministrativeProfileLookupService,
        { provide: getRepositoryToken(AdministrativeProfile), useValue: adminRepo },
      ],
    }).compile();

    service = module.get<AdministrativeProfileLookupService>(AdministrativeProfileLookupService);
  });

  describe('findNamesByUserIds', () => {
    it('returns an empty map without querying when given an empty array', async () => {
      const result = await service.findNamesByUserIds([]);
      expect(result.size).toBe(0);
      expect(adminRepo.find).not.toHaveBeenCalled();
    });

    it('returns a map keyed by userId with firstName/lastName', async () => {
      adminRepo.find.mockResolvedValue([
        { userId: 'user-1', firstName: 'Alice', lastName: 'Dupont' },
        { userId: 'user-2', firstName: 'Bob', lastName: 'Martin' },
      ]);

      const result = await service.findNamesByUserIds(['user-1', 'user-2']);

      expect(result.get('user-1')).toEqual({ firstName: 'Alice', lastName: 'Dupont' });
      expect(result.get('user-2')).toEqual({ firstName: 'Bob', lastName: 'Martin' });
    });

    it('deduplicates userIds before querying (single batched call, no N+1)', async () => {
      adminRepo.find.mockResolvedValue([{ userId: 'user-1', firstName: 'Alice', lastName: 'Dupont' }]);

      await service.findNamesByUserIds(['user-1', 'user-1', 'user-1']);

      expect(adminRepo.find).toHaveBeenCalledTimes(1);
    });

    it('omits userIds without an administrative profile row (caller must treat missing as null)', async () => {
      adminRepo.find.mockResolvedValue([]);

      const result = await service.findNamesByUserIds(['unknown-user']);

      expect(result.has('unknown-user')).toBe(false);
      expect(result.get('unknown-user')).toBeUndefined();
    });

    it('normalizes missing firstName/lastName on an existing profile to null', async () => {
      adminRepo.find.mockResolvedValue([{ userId: 'user-1', firstName: null, lastName: undefined }]);

      const result = await service.findNamesByUserIds(['user-1']);

      expect(result.get('user-1')).toEqual({ firstName: null, lastName: null });
    });
  });

  /**
   * `searchByName` — support de `GET /internal/profiles/search-by-name`
   * (arbitrage du 2026-09-04, `docs/architecture/contacts-messagerie.md`,
   * point 11).
   */
  describe('searchByName', () => {
    let queryBuilder: any;

    beforeEach(() => {
      queryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      adminRepo.createQueryBuilder = jest.fn().mockReturnValue(queryBuilder);
    });

    it('recherche par ILIKE sur firstName OU lastName, avec le plafond transmis', async () => {
      await service.searchByName('durand', 20);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'administrative.firstName ILIKE :q OR administrative.lastName ILIKE :q',
        { q: '%durand%' },
      );
      expect(queryBuilder.limit).toHaveBeenCalledWith(20);
    });

    it('renvoie les profils trouvés tels quels', async () => {
      const profiles = [{ userId: 'user-1', firstName: 'Camille', lastName: 'Durand' }];
      queryBuilder.getMany.mockResolvedValue(profiles);

      const result = await service.searchByName('durand', 20);

      expect(result).toBe(profiles);
    });

    it("renvoie une liste vide quand aucun profil ne correspond — cas normal, pas une erreur", async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      const result = await service.searchByName('inconnu', 20);

      expect(result).toEqual([]);
    });
  });
});
