/**
 * Amorcage de l'application NestJS pour les tests e2e.
 *
 * S'appuie sur l'instance PostgreSQL locale (identifiants visiomath) et une base
 * dediee, pour tourner contre le meme moteur qu'en production sans exiger
 * Docker ni testcontainers.
 *
 * `synchronize` est actif pour NODE_ENV=test : le schema est aligne sur les
 * entites avant chaque suite.
 *
 * profile-service est SIMULE. C'est une dependance externe : la tester ici
 * reviendrait a tester le reseau. Le double permet en revanche de decrire
 * precisement l'etat des relations, y compris un lien rompu.
 */

import { ConflictException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';

import { AppModule } from '../../../src/app.module';
import { createValidationPipe } from '../../../src/common/validation.pipe';
import {
  ProfileServiceClient,
  RelationLookup,
} from '../../../src/teacher-request/clients/profile-service.client';

export const TEST_JWT_SECRET = 'test_jwt_secret_for_e2e';

/**
 * Connexion PostgreSQL locale. La base teacher_request_test doit exister :
 *   PGPASSWORD=visiomath_secret psql -h localhost -U visiomath \
 *     -c "CREATE DATABASE teacher_request_test OWNER visiomath;"
 */
const PG_TEST_URL = 'postgresql://visiomath:visiomath_secret@localhost:5432/teacher_request_test';

function setTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.DATABASE_URL = PG_TEST_URL;
  process.env.PROFILE_SERVICE_URL = 'http://profile-service.test:3002';
  process.env.INTERNAL_SECRET = 'test_internal_secret_for_e2e';
  delete process.env.REDIS_URL;
}

/** Double de profile-service, pilotable depuis les tests. */
export class ProfileServiceStub {
  /** Paires (viewerId → studentId) considerees comme liees. */
  readonly financeOwnerLinks = new Set<string>();
  readonly administrators = new Set<string>();
  readonly createdTeacherStudentLinks: {
    teacherId: string;
    studentId: string;
    isPrincipalTeacher: boolean;
  }[] = [];
  shouldFailLinkCreation = false;

  /**
   * Reproduit le `409` de profile-service : un lien existe deja pour ce couple
   * avec un statut de professeur principal different. Ce n'est pas un rejeu.
   */
  shouldConflictOnLinkCreation = false;

  linkFinanceOwner(financeOwnerId: string, studentId: string): void {
    this.financeOwnerLinks.add(`${financeOwnerId}:${studentId}`);
  }

  unlinkFinanceOwner(financeOwnerId: string, studentId: string): void {
    this.financeOwnerLinks.delete(`${financeOwnerId}:${studentId}`);
  }

  async resolveDisplayName(userId: string): Promise<string | null> {
    return `Nom ${userId.slice(-4)}`;
  }

  async getRelations(viewerId: string, targetId: string): Promise<RelationLookup> {
    return {
      viewerId,
      targetId,
      isSelf: viewerId === targetId,
      isAdministrator: this.administrators.has(viewerId),
      relations: this.financeOwnerLinks.has(`${viewerId}:${targetId}`)
        ? [{ kind: 'finance_owner_of_student' }]
        : [],
    };
  }

  async createTeacherStudentRelation(link: {
    teacherId: string;
    studentId: string;
    isPrincipalTeacher: boolean;
  }): Promise<void> {
    if (this.shouldFailLinkCreation) throw new Error('profile-service injoignable');
    if (this.shouldConflictOnLinkCreation) {
      throw new ConflictException(
        "Un lien existe deja entre cet eleve et ce formateur, avec un statut de professeur principal " +
          "different de celui demande. Verifiez qui est le professeur principal de cet eleve avant de valider.",
      );
    }
    this.createdTeacherStudentLinks.push(link);
  }
}

export interface TestApp {
  app: INestApplication;
  profileService: ProfileServiceStub;
}

export async function createTestApp(): Promise<TestApp> {
  setTestEnv();
  const profileService = new ProfileServiceStub();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ProfileServiceClient)
    .useValue(profileService)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(createValidationPipe());
  await app.init();

  return { app, profileService };
}

/** Jeton d'acces signe comme ceux d'identity-access-service. */
export function makeJwt(userId: string, role: string, secret: string = TEST_JWT_SECRET): string {
  return jwt.sign({ sub: userId, role, type: 'access' }, secret, { expiresIn: '1h' });
}

/** Identifiants lisibles, en UUID de version 4 (exiges par ParseUUIDPipe). */
export const IDS = {
  student1: '00000000-0000-4000-8000-000000000001',
  student2: '00000000-0000-4000-8000-000000000002',
  parent1: '00000000-0000-4000-8000-000000000010',
  teacher1: '00000000-0000-4000-8000-000000000020',
  teacher2: '00000000-0000-4000-8000-000000000021',
  teacher3: '00000000-0000-4000-8000-000000000022',
  rp1: '00000000-0000-4000-8000-000000000030',
  ap1: '00000000-0000-4000-8000-000000000031',
  adminFin: '00000000-0000-4000-8000-000000000040',
  ti: '00000000-0000-4000-8000-000000000050',
  unknown: '00000000-0000-4000-8000-000000009999',
};
