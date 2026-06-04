import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth Service (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
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

  it('POST /auth/register → 201', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'password123' })
      .expect(201)
      .expect((res) => {
        expect(res.body.access_token).toBeDefined();
        expect(res.body.refresh_token).toBeDefined();
      });
  });

  it('POST /auth/login → 200', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })
      .expect(200)
      .expect((res) => expect(res.body.access_token).toBeDefined());
  });

  it('POST /auth/login with bad password → 401', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' })
      .expect(401);
  });
});
