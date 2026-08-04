/**
 * HTTP-level tests for the controller adapter layer: authentication guard,
 * declarative role guard (@Roles/RolesGuard), UUID route-param pipe and DTO
 * body validation, plus response serialization to the response DTOs.
 *
 * The service is fully mocked — no database is involved. Only the HTTP
 * pipeline (guards → pipes → controller → response) is exercised, through a
 * real (non-overridden) JwtAuthGuard/RolesGuard/ValidationPipe.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';

import { TeacherRequestController } from '../../src/teacher-request/teacher-request.controller';
import { TeacherRequestService } from '../../src/teacher-request/teacher-request.service';
import { JwtAuthGuard } from '../../src/common/jwt.guard';
import { RolesGuard } from '../../src/common/roles.guard';
import { UserRole } from '../../src/common/user-role.enum';
import { RequestStatus, RequestType } from '../../src/teacher-request/entities/teacher-request.entity';

const JWT_SECRET = 'unit-test-secret';
const VALID_UUID = '11111111-1111-1111-1111-111111111111';

function makeToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role, type: 'access' }, JWT_SECRET, { expiresIn: '1h' });
}

describe('[HTTP] TeacherRequestController — guards, pipes, serialization', () => {
  let app: INestApplication;
  let mockService: Record<string, jest.Mock>;

  beforeAll(async () => {
    mockService = {
      createRequest: jest.fn(),
      listRequests: jest.fn(),
      getRequest: jest.fn(),
      updateRequestStatus: jest.fn(),
      deleteRequest: jest.fn(),
      createPpChangeRequest: jest.fn(),
      publishSelectedCandidates: jest.fn(),
      selectCandidate: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [TeacherRequestController],
      providers: [
        { provide: TeacherRequestService, useValue: mockService },
        { provide: ConfigService, useValue: { getOrThrow: () => JWT_SECRET, get: () => undefined } },
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('401 — no bearer token (authentication)', async () => {
    const res = await request(app.getHttpServer()).get('/requests');
    expect(res.status).toBe(401);
  });

  it('403 — authenticated with a role not declared via @Roles (authorization)', async () => {
    const token = makeToken('teacher-1', UserRole.FORMATEUR);
    const res = await request(app.getHttpServer())
      .post('/requests/pp-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: VALID_UUID, currentPpTeacherId: VALID_UUID, subject: 'Maths' });

    expect(res.status).toBe(403);
    expect(mockService.createPpChangeRequest).not.toHaveBeenCalled();
  });

  it('400 — invalid UUID route param (ParseUUIDPipe)', async () => {
    const token = makeToken('rp-1', UserRole.RESPONSABLE_PEDAGOGIQUE);
    const res = await request(app.getHttpServer())
      .get('/requests/not-a-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(mockService.getRequest).not.toHaveBeenCalled();
  });

  it('400 — invalid body rejected by DTO validation', async () => {
    const token = makeToken('parent-1', UserRole.PARENT_FINANCEUR);
    const res = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(mockService.createRequest).not.toHaveBeenCalled();
  });

  it('201 — nominal: authorized role, valid body, response serialized to the response DTO shape', async () => {
    const token = makeToken('parent-1', UserRole.PARENT_FINANCEUR);
    mockService.createRequest.mockResolvedValue({
      id: VALID_UUID,
      requesterId: 'parent-1',
      requesterRole: UserRole.PARENT_FINANCEUR,
      studentId: VALID_UUID,
      subject: 'Algèbre',
      level: null,
      sector: null,
      message: null,
      status: RequestStatus.PENDING,
      type: RequestType.SPECIFIC,
      currentPpTeacherId: null,
      selectedTeacherIds: null,
      chosenTeacherId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const res = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: VALID_UUID, subject: 'Algèbre' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: VALID_UUID, status: 'pending', subject: 'Algèbre' });
    expect(mockService.createRequest).toHaveBeenCalledWith(
      { studentId: VALID_UUID, subject: 'Algèbre' },
      expect.objectContaining({ id: 'parent-1', role: UserRole.PARENT_FINANCEUR }),
    );
  });
});
