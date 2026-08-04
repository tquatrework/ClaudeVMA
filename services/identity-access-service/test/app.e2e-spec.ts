import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Identity Access Service (e2e)', () => {
  let app: INestApplication;
  const timestamp = Date.now();
  const testEmail = `test-${timestamp}@example.com`;
  const testPassword = 'password123';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → 200', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('ok'));
  });

  it('POST /accounts → 201 (account created in PENDING status)', () => {
    return request(app.getHttpServer())
      .post('/accounts')
      .send({ email: testEmail, password: testPassword, firstName: 'Jean', lastName: 'Dupont' })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.email).toBe(testEmail);
        expect(res.body.role).toBe('eleve');
        expect(res.body.firstName).toBe('Jean');
        expect(res.body.lastName).toBe('Dupont');
        expect(res.body.validationStatus).toBe('pending');
        expect(res.body.consentSigned).toBe(false);
      });
  });

  it('POST /accounts without firstName/lastName → 400', () => {
    return request(app.getHttpServer())
      .post('/accounts')
      .send({ email: `no-name-${timestamp}@example.com`, password: testPassword })
      .expect(400);
  });

  it('POST /accounts/students without JWT → 201 (public route, no token required)', () => {
    const studentEmail = `student-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({ email: studentEmail, password: testPassword, firstName: 'Lucas', lastName: 'Petit' })
      .expect(201)
      .expect((res) => {
        expect(res.body.student).toBeDefined();
        expect(res.body.student.email).toBe(studentEmail);
        expect(res.body.student.role).toBe('eleve');
        expect(res.body.student.firstName).toBe('Lucas');
        expect(res.body.student.lastName).toBe('Petit');
        expect(res.body.student.validationStatus).toBe('pending');
      });
  });

  it('POST /accounts/students with parentEmail but without parentFirstName/parentLastName → 400', () => {
    const studentEmail = `student-noparentnames-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: studentEmail,
        password: testPassword,
        firstName: 'Lucas',
        lastName: 'Petit',
        parentEmail: `parent-noname-${timestamp}@example.com`,
        parentPassword: testPassword,
      })
      .expect(400);
  });

  it('POST /accounts/students with parentEmail, parentFirstName and parentLastName → 201', () => {
    const studentEmail = `student-withparent-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: studentEmail,
        password: testPassword,
        firstName: 'Lucas',
        lastName: 'Petit',
        parentEmail: `parent-named-${timestamp}@example.com`,
        parentPassword: testPassword,
        parentFirstName: 'Nathalie',
        parentLastName: 'Petit',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.parent).toBeDefined();
        expect(res.body.parent.firstName).toBe('Nathalie');
        expect(res.body.parent.lastName).toBe('Petit');
      });
  });

  it('POST /accounts/teachers without JWT → 201 (public route, no token required)', () => {
    const teacherEmail = `teacher-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/teachers')
      .send({ email: teacherEmail, password: testPassword, firstName: 'Marie', lastName: 'Martin' })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.email).toBe(teacherEmail);
        expect(res.body.role).toBe('formateur');
        expect(res.body.firstName).toBe('Marie');
        expect(res.body.lastName).toBe('Martin');
        expect(res.body.validationStatus).toBe('pending');
      });
  });

  it('POST /accounts/parents without JWT → 201 (public route, no token required)', () => {
    const parentEmail = `parent-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/parents')
      .send({ email: parentEmail, password: testPassword, firstName: 'Sophie', lastName: 'Bernard' })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.email).toBe(parentEmail);
        expect(res.body.role).toBe('parent_financeur');
        expect(res.body.firstName).toBe('Sophie');
        expect(res.body.lastName).toBe('Bernard');
        expect(res.body.validationStatus).toBe('pending');
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
