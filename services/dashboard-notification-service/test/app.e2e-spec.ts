import './e2e-env.setup';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { Notification, NotificationType } from '../src/notification/entities/notification.entity';
import { DashboardPreference } from '../src/dashboard/entities/dashboard-preference.entity';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET as string;
const JWT_SECRET = process.env.JWT_SECRET as string;

function makeAccessToken(jwtService: JwtService, overrides: Record<string, unknown> = {}) {
  return jwtService.sign(
    {
      sub: 'user-uuid-1111',
      email: 'test@example.com',
      role: 'eleve',
      validationStatus: 'validated',
      jti: 'jti-test',
      type: 'access',
      ...overrides,
    },
    { secret: JWT_SECRET },
  );
}

describe('Dashboard Notification Service (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let notificationRepo: any;
  let preferenceRepo: any;

  beforeAll(async () => {
    // Env variables are set by test/e2e-env.setup.ts, imported above before
    // AppModule so its startup validation (src/config/env.validation.ts)
    // sees them.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    notificationRepo = moduleFixture.get(getRepositoryToken(Notification));
    preferenceRepo = moduleFixture.get(getRepositoryToken(DashboardPreference));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await notificationRepo.query('DELETE FROM notifications').catch(() => {});
    await preferenceRepo.query('DELETE FROM dashboard_preferences').catch(() => {});
  });

  describe('GET /health', () => {
    it('returns 200 with service name', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('dashboard-notification-service');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /dashboards/me', () => {
    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/dashboards/me').expect(401);
    });

    it('returns 401 with malformed token', async () => {
      await request(app.getHttpServer())
        .get('/dashboards/me')
        .set('Authorization', 'Bearer not-a-valid-token')
        .expect(401);
    });

    it('returns 200 with correct dashboard structure for eleve', async () => {
      const token = makeAccessToken(jwtService, { role: 'eleve' });
      const res = await request(app.getHttpServer())
        .get('/dashboards/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.userId).toBe('user-uuid-1111');
      expect(res.body.role).toBe('eleve');
      expect(Array.isArray(res.body.widgets)).toBe(true);
      expect(Array.isArray(res.body.notifications)).toBe(true);
      expect(res.body.generatedAt).toBeDefined();
    });

    it('returns 200 for responsable_pedagogique with payment_alerts widget', async () => {
      const token = makeAccessToken(jwtService, {
        sub: 'rp-uuid-2222',
        role: 'responsable_pedagogique',
      });
      const res = await request(app.getHttpServer())
        .get('/dashboards/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.role).toBe('responsable_pedagogique');
      const widgetTypes = res.body.widgets.map((w: any) => w.type);
      expect(widgetTypes).toContain('payment_alerts');
      expect(widgetTypes).toContain('pending_teacher_requests');
    });

    it('parent_financeur dashboard does not expose personal notebook widget', async () => {
      const token = makeAccessToken(jwtService, {
        sub: 'parent-uuid-3333',
        role: 'parent_financeur',
      });
      const res = await request(app.getHttpServer())
        .get('/dashboards/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const widgetTypes = res.body.widgets.map((w: any) => w.type);
      expect(widgetTypes).not.toContain('personal_notebook');
    });
  });

  describe('PUT /dashboards/me/preferences', () => {
    it('saves preferences and returns updated config', async () => {
      const token = makeAccessToken(jwtService);
      const res = await request(app.getHttpServer())
        .put('/dashboards/me/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ widgetConfig: { showCalendar: false, compactView: true } })
        .expect(200);

      expect(res.body.userId).toBe('user-uuid-1111');
      expect(res.body.widgetConfig.showCalendar).toBe(false);
    });

    it('returns 400 with invalid body', async () => {
      const token = makeAccessToken(jwtService);
      await request(app.getHttpServer())
        .put('/dashboards/me/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ widgetConfig: 'not-an-object' })
        .expect(400);
    });
  });

  describe('GET /notifications', () => {
    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/notifications').expect(401);
    });

    it('returns paginated list for authenticated user', async () => {
      const userId = 'user-uuid-1111';
      await notificationRepo.save(
        notificationRepo.create({
          userId,
          type: NotificationType.SYSTEM,
          title: 'Test',
          message: 'Hello',
          isRead: false,
        }),
      );

      const token = makeAccessToken(jwtService);
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('filters by isRead=false', async () => {
      const userId = 'user-uuid-1111';
      await notificationRepo.save([
        notificationRepo.create({ userId, type: NotificationType.SYSTEM, title: 'Unread', message: 'msg', isRead: false }),
        notificationRepo.create({ userId, type: NotificationType.SYSTEM, title: 'Read', message: 'msg', isRead: true }),
      ]);

      const token = makeAccessToken(jwtService);
      const res = await request(app.getHttpServer())
        .get('/notifications?isRead=false')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.every((n: any) => n.isRead === false)).toBe(true);
    });
  });

  describe('POST /notifications/:notificationId/read', () => {
    it('marks notification as read', async () => {
      const userId = 'user-uuid-1111';
      const notif = await notificationRepo.save(
        notificationRepo.create({
          userId,
          type: NotificationType.SYSTEM,
          title: 'To read',
          message: 'msg',
          isRead: false,
        }),
      );

      const token = makeAccessToken(jwtService);
      const res = await request(app.getHttpServer())
        .post(`/notifications/${notif.id}/read`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.isRead).toBe(true);
    });

    it('returns 404 for non-existent notification', async () => {
      const token = makeAccessToken(jwtService);
      await request(app.getHttpServer())
        .post('/notifications/00000000-0000-0000-0000-000000000000/read')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('POST /internal/initialize-dashboard', () => {
    it('returns 401 without X-Internal-Secret header', async () => {
      await request(app.getHttpServer())
        .post('/internal/initialize-dashboard')
        .send({ userId: '00000000-0000-0000-0000-000000000001', role: 'eleve' })
        .expect(401);
    });

    it('returns 401 with wrong X-Internal-Secret', async () => {
      await request(app.getHttpServer())
        .post('/internal/initialize-dashboard')
        .set('x-internal-secret', 'wrong-secret')
        .send({ userId: '00000000-0000-0000-0000-000000000001', role: 'eleve' })
        .expect(401);
    });

    it('returns 201 and creates preference with correct X-Internal-Secret', async () => {
      const userId = '00000000-0000-0000-0000-000000000002';
      const res = await request(app.getHttpServer())
        .post('/internal/initialize-dashboard')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId, role: 'eleve' })
        .expect(201);

      expect(res.body.userId).toBe(userId);
      expect(res.body.role).toBe('eleve');
    });

    it('is idempotent — calling twice does not create duplicate', async () => {
      const userId = '00000000-0000-0000-0000-000000000003';
      await request(app.getHttpServer())
        .post('/internal/initialize-dashboard')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId, role: 'formateur' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/internal/initialize-dashboard')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId, role: 'formateur' })
        .expect(201);

      const prefs = await preferenceRepo.find({ where: { userId } });
      expect(prefs.length).toBe(1);
    });

    it('returns 400 with invalid body', async () => {
      await request(app.getHttpServer())
        .post('/internal/initialize-dashboard')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: 'not-a-uuid', role: 'eleve' })
        .expect(400);
    });
  });

  describe('POST /internal/notify', () => {
    it('creates notification for targetUserId', async () => {
      const userId = '00000000-0000-0000-0000-000000000010';
      const res = await request(app.getHttpServer())
        .post('/internal/notify')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          targetUserId: userId,
          type: NotificationType.TEACHER_REQUEST_CREATED,
          title: 'Nouvelle demande',
          message: 'Une demande professeur a été créée.',
        })
        .expect(201);

      expect(res.body.userId).toBe(userId);
      expect(res.body.type).toBe(NotificationType.TEACHER_REQUEST_CREATED);
    });

    it('creates notification for targetRole', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/notify')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          targetRole: 'responsable_pedagogique',
          type: NotificationType.PAYMENT_FAILED,
          title: 'Défaut de paiement',
          message: 'Un paiement a échoué.',
        })
        .expect(201);

      expect(res.body.userId).toBe('role:responsable_pedagogique');
    });

    it('returns 400 when neither targetUserId nor targetRole is provided', async () => {
      await request(app.getHttpServer())
        .post('/internal/notify')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          type: NotificationType.SYSTEM,
          title: 'Oops',
          message: 'Missing target.',
        })
        .expect(400);
    });

    it('returns 401 without X-Internal-Secret', async () => {
      await request(app.getHttpServer())
        .post('/internal/notify')
        .send({
          targetUserId: '00000000-0000-0000-0000-000000000010',
          type: NotificationType.SYSTEM,
          title: 'Test',
          message: 'msg',
        })
        .expect(401);
    });
  });
});
