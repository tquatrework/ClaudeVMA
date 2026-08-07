import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AdministrativeProfile } from './entities/administrative-profile.entity';

/**
 * Minimal, non-identifying-beyond-name projection of an AdministrativeProfile,
 * used to display "who is this user" (e.g. in relation lists) without
 * exposing the rest of the profile.
 */
export interface AdministrativeName {
  firstName: string | null;
  lastName: string | null;
}

/**
 * Narrow, read-only port exposing administrative profile *names* (firstName/
 * lastName only) to other features (e.g. RelationsService) that need to
 * display the identity of the other party in a relation, without needing
 * full profile read/write access or its authorization logic (that remains
 * ProfilesService's responsibility).
 *
 * Deliberately extracted as its own provider instead of a ProfilesService
 * method: ProfilesService already depends on RelationsService, so a
 * RelationsService -> ProfilesService dependency would create a
 * provider-level circular dependency. This service has no dependency on
 * RelationsService (or anything else besides its own repository), so
 * RelationsModule can safely import ProfilesModule to consume it — the
 * remaining circularity is purely a module-level import cycle (each module
 * needs a capability exported by the other), resolved with forwardRef() in
 * both ProfilesModule and RelationsModule.
 */
@Injectable()
export class AdministrativeProfileLookupService {
  constructor(
    @InjectRepository(AdministrativeProfile)
    private readonly adminRepo: Repository<AdministrativeProfile>,
  ) {}

  /**
   * Batch-fetch firstName/lastName for a set of userIds in a single query
   * (avoids N+1 — services-convention). Users without an administrative
   * profile row are simply absent from the returned map; callers must treat
   * a missing entry as "unknown name" rather than an error, and never let a
   * missing/incomplete name fail the caller's request.
   */
  async findNamesByUserIds(userIds: string[]): Promise<Map<string, AdministrativeName>> {
    const distinctIds = [...new Set(userIds)];
    if (distinctIds.length === 0) {
      return new Map();
    }

    const profiles = await this.adminRepo.find({ where: { userId: In(distinctIds) } });

    return new Map(
      profiles.map((profile) => [
        profile.userId,
        { firstName: profile.firstName ?? null, lastName: profile.lastName ?? null },
      ]),
    );
  }
}
