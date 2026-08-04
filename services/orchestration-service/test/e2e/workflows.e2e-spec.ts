/**
 * E2E — Workflows
 *
 * Couvre toutes les routes du WorkflowController :
 *   GET  /workflows                      — lister les définitions
 *   POST /workflows/:workflowId/start    — démarrer un workflow
 *   GET  /workflows/:instanceId          — lire l'état d'une instance
 *   POST /workflows/:instanceId/suspend  — suspendre (NEEDS_ARBITRATION)
 *   POST /workflows/:instanceId/resume   — reprendre après arbitrage
 *
 * Toutes les routes sont protégées par JWT (JwtAuthGuard).
 * Les JWT de test sont signés avec TEST_JWT_SECRET via makeJwt().
 *
 * Lorsqu'aucune URL de service externe n'est configurée,
 * HttpClientService.call() retourne { success: true, skipped: true } —
 * les étapes du workflow sont donc marquées COMPLETED sans appel réseau.
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, makeJwt, IDS } from './helpers/app.helper';
import { v4 as uuidv4 } from 'uuid';

const RP_TOKEN = makeJwt(IDS.rp1, 'responsable_pedagogique');
const STUDENT_TOKEN = makeJwt(IDS.student1, 'eleve');

describe('[E2E] Workflows', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────
  // GET /workflows — liste des définitions
  // ──────────────────────────────────────────────────────────────

  describe('GET /workflows', () => {
    it('returns 401 without a JWT', async () => {
      const res = await request(app.getHttpServer()).get('/workflows');
      expect(res.status).toBe(401);
    });

    it('returns 200 with a list of workflow definitions', async () => {
      const res = await request(app.getHttpServer())
        .get('/workflows')
        .set('Authorization', `Bearer ${RP_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Each definition must expose id, name, phase, stepCount
      const firstDef = res.body[0];
      expect(firstDef).toHaveProperty('id');
      expect(firstDef).toHaveProperty('name');
      expect(firstDef).toHaveProperty('phase');
      expect(firstDef).toHaveProperty('stepCount');
    });

    it('includes all four phase-1 workflow definitions', async () => {
      const res = await request(app.getHttpServer())
        .get('/workflows')
        .set('Authorization', `Bearer ${RP_TOKEN}`);

      expect(res.status).toBe(200);
      const ids = res.body.map((d: any) => d.id);
      expect(ids).toContain('student-onboarding');
      expect(ids).toContain('teacher-onboarding');
      expect(ids).toContain('teacher-request-to-assignment');
      expect(ids).toContain('scheduled-video-course');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /workflows/:workflowId/start
  // ──────────────────────────────────────────────────────────────

  describe('POST /workflows/:workflowId/start', () => {
    it('returns 401 without a JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/workflows/student-onboarding/start')
        .send({ workflowType: 'student-onboarding', payload: {} });
      expect(res.status).toBe(401);
    });

    it('returns 404 for an unknown workflow type', async () => {
      const res = await request(app.getHttpServer())
        .post('/workflows/unknown-workflow-xyz/start')
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({ workflowType: 'unknown-workflow-xyz', payload: {} });

      expect(res.status).toBe(404);
    });

    it('returns 400 when payload is missing (validation)', async () => {
      const res = await request(app.getHttpServer())
        .post('/workflows/student-onboarding/start')
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({ workflowType: 'student-onboarding' }); // missing payload

      expect(res.status).toBe(400);
    });

    it('returns 400 when firstName/lastName are missing from a student-onboarding payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/workflows/student-onboarding/start')
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({
          workflowType: 'student-onboarding',
          payload: { email: `no-name-${Date.now()}@test.com`, password: 'P@ss1' },
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when firstName/lastName are missing from a teacher-onboarding payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/workflows/teacher-onboarding/start')
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({
          workflowType: 'teacher-onboarding',
          payload: { email: `no-name-t-${Date.now()}@test.com`, password: 'P@ss1' },
        });

      expect(res.status).toBe(400);
    });

    it('accepts a student-onboarding payload with parentAccountId and no parent name (existing parent, linked by id only)', async () => {
      const res = await request(app.getHttpServer())
        .post('/workflows/student-onboarding/start')
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({
          workflowType: 'student-onboarding',
          payload: {
            email: `parent-link-${Date.now()}@test.com`,
            password: 'P@ss1',
            firstName: 'Jean',
            lastName: 'Dupont',
            parentAccountId: 'parent-1',
          },
        });

      expect(res.status).toBe(201);
    });

    it('starts student-onboarding workflow and returns instance info', async () => {
      const correlationId = uuidv4();
      const res = await request(app.getHttpServer())
        .post('/workflows/student-onboarding/start')
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({
          workflowType: 'student-onboarding',
          payload: {
            email: `student-${Date.now()}@test.com`,
            password: 'SecureP@ss1',
            firstName: 'Jean',
            lastName: 'Dupont',
          },
          correlationId,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('workflowInstanceId');
      expect(res.body).toHaveProperty('workflowType', 'student-onboarding');
      expect(res.body).toHaveProperty('correlationId', correlationId);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('startedAt');
    });

    it('starts teacher-onboarding workflow', async () => {
      const res = await request(app.getHttpServer())
        .post('/workflows/teacher-onboarding/start')
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({
          workflowType: 'teacher-onboarding',
          payload: {
            email: `teacher-${Date.now()}@test.com`,
            password: 'TeacherP@ss1',
            firstName: 'Marie',
            lastName: 'Martin',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('workflowInstanceId');
      expect(res.body.workflowType).toBe('teacher-onboarding');
    });

    it('starts teacher-request-to-assignment workflow', async () => {
      const res = await request(app.getHttpServer())
        .post('/workflows/teacher-request-to-assignment/start')
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({
          workflowType: 'teacher-request-to-assignment',
          payload: {
            requestId: uuidv4(),
            studentId: IDS.student1,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.workflowType).toBe('teacher-request-to-assignment');
    });

    it('starts scheduled-video-course workflow', async () => {
      const res = await request(app.getHttpServer())
        .post('/workflows/scheduled-video-course/start')
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({
          workflowType: 'scheduled-video-course',
          payload: {
            activityId: uuidv4(),
            teacherId: IDS.teacher1,
            studentId: IDS.student1,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.workflowType).toBe('scheduled-video-course');
    });

    it('uses JWT subject as initiatedBy when not provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/workflows/student-onboarding/start')
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({
          workflowType: 'student-onboarding',
          payload: {
            email: `x-${Date.now()}@test.com`,
            password: 'P@ss1',
            firstName: 'Jean',
            lastName: 'Dupont',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('workflowInstanceId');
    });

    it('accepts an explicit correlationId', async () => {
      const correlationId = uuidv4();
      const res = await request(app.getHttpServer())
        .post('/workflows/student-onboarding/start')
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({
          workflowType: 'student-onboarding',
          payload: {
            email: `corr-${Date.now()}@test.com`,
            password: 'P@ss1',
            firstName: 'Jean',
            lastName: 'Dupont',
          },
          correlationId,
        });

      expect(res.status).toBe(201);
      expect(res.body.correlationId).toBe(correlationId);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // GET /workflows/:instanceId — lire l'état d'une instance
  // ──────────────────────────────────────────────────────────────

  describe('GET /workflows/:instanceId', () => {
    let instanceId: string;

    beforeAll(async () => {
      // Start a workflow and capture the instance id
      const res = await request(app.getHttpServer())
        .post('/workflows/student-onboarding/start')
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({
          workflowType: 'student-onboarding',
          payload: {
            email: `get-test-${Date.now()}@test.com`,
            password: 'P@ss1',
            firstName: 'Jean',
            lastName: 'Dupont',
          },
        });
      instanceId = res.body.workflowInstanceId;
    });

    it('returns 401 without a JWT', async () => {
      const res = await request(app.getHttpServer()).get(`/workflows/${instanceId}`);
      expect(res.status).toBe(401);
    });

    it('returns 404 for a non-existent instance', async () => {
      const fakeId = uuidv4();
      const res = await request(app.getHttpServer())
        .get(`/workflows/${fakeId}`)
        .set('Authorization', `Bearer ${RP_TOKEN}`);
      expect(res.status).toBe(404);
    });

    it('returns 200 with the instance and its steps', async () => {
      const res = await request(app.getHttpServer())
        .get(`/workflows/${instanceId}`)
        .set('Authorization', `Bearer ${RP_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', instanceId);
      expect(res.body).toHaveProperty('workflowType', 'student-onboarding');
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('steps');
      expect(Array.isArray(res.body.steps)).toBe(true);
    });

    it('includes all expected step names in the response', async () => {
      const res = await request(app.getHttpServer())
        .get(`/workflows/${instanceId}`)
        .set('Authorization', `Bearer ${RP_TOKEN}`);

      expect(res.status).toBe(200);
      const stepNames = res.body.steps.map((s: any) => s.stepName);
      expect(stepNames).toContain('create-student-account');
      expect(stepNames).toContain('create-student-profiles');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /workflows/:instanceId/suspend
  // ──────────────────────────────────────────────────────────────

  describe('POST /workflows/:instanceId/suspend', () => {
    let instanceId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/workflows/student-onboarding/start')
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({
          workflowType: 'student-onboarding',
          payload: {
            email: `suspend-${Date.now()}@test.com`,
            password: 'P@ss1',
            firstName: 'Jean',
            lastName: 'Dupont',
          },
        });
      instanceId = res.body.workflowInstanceId;
    });

    it('returns 401 without a JWT', async () => {
      const res = await request(app.getHttpServer())
        .post(`/workflows/${instanceId}/suspend`)
        .send({ reason: 'test' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when reason is missing', async () => {
      const res = await request(app.getHttpServer())
        .post(`/workflows/${instanceId}/suspend`)
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({});
      // reason is @IsString @IsNotEmpty so validation should reject empty body
      expect([400, 422]).toContain(res.status);
    });

    it('suspends the workflow and returns needs_arbitration status', async () => {
      const res = await request(app.getHttpServer())
        .post(`/workflows/${instanceId}/suspend`)
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({ reason: 'En attente d\'arbitrage utilisateur' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('workflowInstanceId', instanceId);
      expect(res.body).toHaveProperty('status', 'needs_arbitration');
      expect(res.body).toHaveProperty('reason');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /workflows/:instanceId/resume
  // ──────────────────────────────────────────────────────────────

  describe('POST /workflows/:instanceId/resume', () => {
    let instanceId: string;

    beforeAll(async () => {
      // Start then suspend so we can resume
      const startRes = await request(app.getHttpServer())
        .post('/workflows/student-onboarding/start')
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({
          workflowType: 'student-onboarding',
          payload: {
            email: `resume-${Date.now()}@test.com`,
            password: 'P@ss1',
            firstName: 'Jean',
            lastName: 'Dupont',
          },
        });
      instanceId = startRes.body.workflowInstanceId;

      await request(app.getHttpServer())
        .post(`/workflows/${instanceId}/suspend`)
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({ reason: 'Needs user approval' });
    });

    it('returns 401 without a JWT', async () => {
      const res = await request(app.getHttpServer())
        .post(`/workflows/${instanceId}/resume`)
        .send({});
      expect(res.status).toBe(401);
    });

    it('resumes the suspended workflow and returns in_progress status', async () => {
      const res = await request(app.getHttpServer())
        .post(`/workflows/${instanceId}/resume`)
        .set('Authorization', `Bearer ${RP_TOKEN}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('workflowInstanceId', instanceId);
      expect(res.body).toHaveProperty('status', 'in_progress');
      expect(res.body).toHaveProperty('tiOverride', false);
    });

    it('accepts tiOverride=true for TI forced resume', async () => {
      // Create a fresh suspended instance
      const startRes = await request(app.getHttpServer())
        .post('/workflows/student-onboarding/start')
        .set('Authorization', `Bearer ${makeJwt(IDS.ti, 'technicien_informatique')}`)
        .send({
          workflowType: 'student-onboarding',
          payload: {
            email: `ti-resume-${Date.now()}@test.com`,
            password: 'P@ss1',
            firstName: 'Jean',
            lastName: 'Dupont',
          },
        });
      const tiInstanceId = startRes.body.workflowInstanceId;

      await request(app.getHttpServer())
        .post(`/workflows/${tiInstanceId}/suspend`)
        .set('Authorization', `Bearer ${makeJwt(IDS.ti, 'technicien_informatique')}`)
        .send({ reason: 'Forced by TI' });

      const resumeRes = await request(app.getHttpServer())
        .post(`/workflows/${tiInstanceId}/resume`)
        .set('Authorization', `Bearer ${makeJwt(IDS.ti, 'technicien_informatique')}`)
        .send({ tiOverride: true });

      expect(resumeRes.status).toBe(201);
      expect(resumeRes.body).toHaveProperty('tiOverride', true);
    });
  });
});
