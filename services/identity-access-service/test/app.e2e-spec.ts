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
      .send({ email: testEmail, password: testPassword })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.email).toBe(testEmail);
        expect(res.body.role).toBe('eleve');
        expect(res.body.validationStatus).toBe('pending');
        expect(res.body.consentSigned).toBe(false);
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
