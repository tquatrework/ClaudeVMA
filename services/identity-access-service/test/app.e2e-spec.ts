import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProfileServiceClient } from '../src/common/clients/profile-service.client';

describe('Identity Access Service (e2e)', () => {
  let app: INestApplication;
  const timestamp = Date.now();
  const testEmail = `test-${timestamp}@example.com`;
  const testPassword = 'password123';

  // profile-service n'est pas disponible dans cet environnement de test e2e.
  // Depuis l'arbitrage d'architecture du 2026-08-06, identity-access-service
  // ne collecte plus du tout firstName/lastName/phone (propriété exclusive de
  // profile-service) : ProfileServiceClient ne porte plus que la liaison
  // finance-owner-student (linkParentToStudent), stubbée ici pour tester le
  // comportement HTTP propre de identity-access-service sans dépendance
  // réseau réelle (les échecs/rollback de ProfileServiceClient sont couverts
  // par ailleurs par accounts.service.spec.ts et profile-service.client.spec.ts).
  const profileServiceClientStub = {
    linkParentToStudent: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProfileServiceClient)
      .useValue(profileServiceClientStub)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    profileServiceClientStub.linkParentToStudent.mockReset().mockResolvedValue(undefined);
  });

  it('GET /health → 200', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('ok'));
  });

  it('POST /accounts → 201 (account created, no firstName/lastName/phone collected or exposed)', () => {
    return request(app.getHttpServer())
      .post('/accounts')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.email).toBe(testEmail);
        expect(res.body.role).toBe('eleve');
        expect(res.body.firstName).toBeUndefined();
        expect(res.body.lastName).toBeUndefined();
        expect(res.body.phone).toBeUndefined();
        expect(res.body.validationStatus).toBe('pending');
        expect(res.body.consentSigned).toBe(false);
      });
  });

  it('POST /accounts rejects unknown fields firstName/lastName/phoneNumber → 400 (whitelist validation)', () => {
    return request(app.getHttpServer())
      .post('/accounts')
      .send({
        email: `unknown-fields-${timestamp}@example.com`,
        password: testPassword,
        firstName: 'Jean',
        lastName: 'Dupont',
        phoneNumber: '+33 6 01 02 03 04',
      })
      .expect(400);
  });

  it('POST /accounts/students without JWT → 201 (public route, no token required)', () => {
    const studentEmail = `student-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({ email: studentEmail, password: testPassword })
      .expect(201)
      .expect((res) => {
        expect(res.body.student).toBeDefined();
        expect(res.body.student.email).toBe(studentEmail);
        expect(res.body.student.role).toBe('eleve');
        expect(res.body.student.firstName).toBeUndefined();
        expect(res.body.student.lastName).toBeUndefined();
        expect(res.body.student.validationStatus).toBe('pending');
      });
  });

  it('POST /accounts/students with parentEmail → 201, and the parent is linked as finance owner', () => {
    const studentEmail = `student-withparent-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: studentEmail,
        password: testPassword,
        parentEmail: `parent-named-${timestamp}@example.com`,
        parentPassword: testPassword,
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.parent).toBeDefined();
        expect(res.body.parent.firstName).toBeUndefined();
        expect(res.body.parent.lastName).toBeUndefined();
        expect(profileServiceClientStub.linkParentToStudent).toHaveBeenCalledWith({
          studentId: res.body.student.id,
          financeOwnerId: res.body.parent.id,
        });
      });
  });

  it('POST /accounts/students → 503 and no account left behind when profile-service link call fails', async () => {
    const failingEmail = `link-down-${timestamp}@example.com`;
    profileServiceClientStub.linkParentToStudent.mockRejectedValueOnce(new Error('profile-service unreachable'));

    await request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: failingEmail,
        password: testPassword,
        parentEmail: `parent-down-${timestamp}@example.com`,
        parentPassword: testPassword,
      })
      .expect(503);

    // The email must be free again — the transaction was rolled back.
    return request(app.getHttpServer())
      .get('/accounts/check-email')
      .query({ email: failingEmail })
      .expect(200)
      .expect((res) => {
        expect(res.body.alreadyUsed).toBe(false);
      });
  });

  it('POST /accounts/teachers without JWT → 201 (public route, no token required)', () => {
    const teacherEmail = `teacher-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/teachers')
      .send({ email: teacherEmail, password: testPassword })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.email).toBe(teacherEmail);
        expect(res.body.role).toBe('formateur');
        expect(res.body.firstName).toBeUndefined();
        expect(res.body.lastName).toBeUndefined();
        expect(res.body.validationStatus).toBe('pending');
      });
  });

  it('POST /accounts/parents without JWT → 201 (public route, no token required)', () => {
    const parentEmail = `parent-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/parents')
      .send({ email: parentEmail, password: testPassword })
      .expect(201)
      .expect((res) => {
        expect(res.body.parent).toBeDefined();
        expect(res.body.parent.email).toBe(parentEmail);
        expect(res.body.parent.role).toBe('parent_financeur');
        expect(res.body.parent.firstName).toBeUndefined();
        expect(res.body.parent.lastName).toBeUndefined();
        expect(res.body.parent.validationStatus).toBe('pending');
        expect(res.body.student).toBeNull();
      });
  });

  it('POST /accounts/parents with studentEmail → 201, and the student is linked as financed student', () => {
    const parentEmail = `parent-withstudent-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/parents')
      .send({
        email: parentEmail,
        password: testPassword,
        studentEmail: `student-named-${timestamp}@example.com`,
        studentPassword: testPassword,
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.student).toBeDefined();
        expect(res.body.student.created).toBe(true);
        expect(res.body.student.firstName).toBeUndefined();
        expect(res.body.student.lastName).toBeUndefined();
        expect(profileServiceClientStub.linkParentToStudent).toHaveBeenCalledWith({
          studentId: res.body.student.id,
          financeOwnerId: res.body.parent.id,
        });
      });
  });

  it('POST /auth/login → 201 after account creation', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(201)
      .expect((res) => {
        expect(res.body.access_token).toBeDefined();
        expect(res.body.refresh_token).toBeDefined();
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe(testEmail);
      });
  });

  it('POST /auth/login with bad password → 401', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testEmail, password: 'wrongpassword' })
      .expect(401);
  });
});
