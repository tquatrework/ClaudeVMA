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
  // Depuis le 2026-08-05, identity-access-service ne stocke plus firstName/
  // lastName/phone localement : ProfileServiceClient est l'unique lieu
  // d'écriture de ces données, et un appel réel échouerait systématiquement.
  // On stub le client pour tester le comportement HTTP propre de
  // identity-access-service (les échecs/rollback de ProfileServiceClient sont
  // couverts par ailleurs par accounts.service.spec.ts et
  // profile-service.client.spec.ts).
  const profileServiceClientStub = {
    createAdministrativeProfile: jest.fn().mockResolvedValue(undefined),
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
    profileServiceClientStub.createAdministrativeProfile.mockReset().mockResolvedValue(undefined);
    profileServiceClientStub.linkParentToStudent.mockReset().mockResolvedValue(undefined);
  });

  it('GET /health → 200', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('ok'));
  });

  it('POST /accounts → 201 (generic route, does not collect nor forward firstName/lastName/phone)', () => {
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
        expect(res.body.validationStatus).toBe('pending');
        expect(res.body.consentSigned).toBe(false);
        expect(profileServiceClientStub.createAdministrativeProfile).not.toHaveBeenCalled();
      });
  });

  it('POST /accounts with firstName/lastName → 400 (unknown fields rejected, whitelist:true)', () => {
    return request(app.getHttpServer())
      .post('/accounts')
      .send({
        email: `rejected-name-${timestamp}@example.com`,
        password: testPassword,
        firstName: 'Jean',
        lastName: 'Dupont',
      })
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
        expect(res.body.student.firstName).toBeUndefined();
        expect(res.body.student.lastName).toBeUndefined();
        expect(res.body.student.validationStatus).toBe('pending');
      });
  });

  // --- Consentements recueillis à l'inscription (arbitrage du 2026-08-09) -----

  it('POST /accounts/students with rgpd + cgu consents → 201 ACTIVE, consents recorded', () => {
    const studentEmail = `student-consent-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: studentEmail,
        password: testPassword,
        firstName: 'Lucas',
        lastName: 'Petit',
        consents: [{ consentType: 'rgpd' }, { consentType: 'cgu' }],
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.student.validationStatus).toBe('active');
        expect(res.body.student.consentSigned).toBe(true);
      });
  });

  it('POST /accounts/students with only rgpd → 201 but still PENDING', () => {
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: `student-halfconsent-${timestamp}@example.com`,
        password: testPassword,
        firstName: 'Lucas',
        lastName: 'Petit',
        consents: [{ consentType: 'rgpd' }],
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.student.validationStatus).toBe('pending');
        expect(res.body.student.consentSigned).toBe(false);
      });
  });

  it('POST /accounts/students with the legacy boolean map {rgpd, cgu} → 400', () => {
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: `student-oldconsent-${timestamp}@example.com`,
        password: testPassword,
        firstName: 'Lucas',
        lastName: 'Petit',
        consents: { rgpd: true, cgu: true },
      })
      .expect(400);
  });

  it('POST /accounts/students with a duplicated consentType → 400', () => {
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: `student-dupconsent-${timestamp}@example.com`,
        password: testPassword,
        firstName: 'Lucas',
        lastName: 'Petit',
        consents: [{ consentType: 'rgpd' }, { consentType: 'rgpd' }],
      })
      .expect(400)
      .expect((res) => expect(JSON.stringify(res.body.message)).toContain('duplicated consentType'));
  });

  it('POST /accounts/students with birthDate → 400 (field owned by profile-service, never absorbed)', () => {
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: `student-birthdate-${timestamp}@example.com`,
        password: testPassword,
        firstName: 'Lucas',
        lastName: 'Petit',
        birthDate: '2008-05-14',
      })
      .expect(400)
      .expect((res) => expect(JSON.stringify(res.body.message)).toContain('birthDate'));
  });

  it('POST /accounts/students with parentConsents → 400 (a consent is never presumed for a linked account)', () => {
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: `student-parentconsent-${timestamp}@example.com`,
        password: testPassword,
        firstName: 'Lucas',
        lastName: 'Petit',
        parentConsents: [{ consentType: 'rgpd' }],
      })
      .expect(400)
      .expect((res) => expect(JSON.stringify(res.body.message)).toContain('parentConsents'));
  });

  it('POST /accounts/students with consents + created parent → parent stays PENDING without consent', () => {
    const studentEmail = `student-linkedconsent-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: studentEmail,
        password: testPassword,
        firstName: 'Lucas',
        lastName: 'Petit',
        consents: [{ consentType: 'rgpd' }, { consentType: 'cgu' }],
        parentAccountMode: 'new',
        parentLoginIdentifier: `nathalie.petit.${timestamp}`,
        parentEmail: `parent-linkedconsent-${timestamp}@example.com`,
        parentFirstName: 'Nathalie',
        parentLastName: 'Petit',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.student.consentSigned).toBe(true);
        expect(res.body.student.validationStatus).toBe('active');
        expect(res.body.parent.consentSigned).toBe(false);
        expect(res.body.parent.validationStatus).toBe('pending');
      });
  });

  it('POST /accounts with consents → 201 ACTIVE (generic route, also used by /internal/create-account)', () => {
    return request(app.getHttpServer())
      .post('/accounts')
      .send({
        email: `generic-consent-${timestamp}@example.com`,
        password: testPassword,
        consents: [{ consentType: 'rgpd' }, { consentType: 'cgu' }],
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.validationStatus).toBe('active');
        expect(res.body.consentSigned).toBe(true);
      });
  });

  it('POST /accounts/students without firstName/lastName → 400', () => {
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({ email: `student-noname-${timestamp}@example.com`, password: testPassword })
      .expect(400);
  });

  it('POST /accounts/students with parent fields but without parentAccountMode → 400', () => {
    const studentEmail = `student-nomode-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: studentEmail,
        password: testPassword,
        firstName: 'Lucas',
        lastName: 'Petit',
        parentEmail: `parent-nomode-${timestamp}@example.com`,
        parentPassword: testPassword,
        parentFirstName: 'Nathalie',
        parentLastName: 'Petit',
      })
      .expect(400);
  });

  it("POST /accounts/students with parentAccountMode 'new' but without parentLoginIdentifier → 400", () => {
    const studentEmail = `student-noparentid-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: studentEmail,
        password: testPassword,
        firstName: 'Lucas',
        lastName: 'Petit',
        parentAccountMode: 'new',
        parentEmail: `parent-noid-${timestamp}@example.com`,
        parentPassword: testPassword,
        parentFirstName: 'Nathalie',
        parentLastName: 'Petit',
      })
      .expect(400);
  });

  it("POST /accounts/students with parentAccountMode 'existing' and creation fields → 400 (no field is silently ignored)", () => {
    const studentEmail = `student-mixedintent-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: studentEmail,
        password: testPassword,
        firstName: 'Lucas',
        lastName: 'Petit',
        parentAccountMode: 'existing',
        parentLoginIdentifier: `parent-existing-${timestamp}`,
        parentEmail: `parent-mixed-${timestamp}@example.com`,
      })
      .expect(400);
  });

  it("POST /accounts/students with parentAccountMode 'new' → 201, the parent keeps the chosen loginIdentifier and is linked as finance owner", () => {
    const studentEmail = `student-withparent-${timestamp}@example.com`;
    const parentLoginIdentifier = `choisi.parent.${timestamp}`;
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: studentEmail,
        password: testPassword,
        firstName: 'Lucas',
        lastName: 'Petit',
        parentAccountMode: 'new',
        parentLoginIdentifier,
        parentEmail: `parent-named-${timestamp}@example.com`,
        parentPassword: testPassword,
        parentFirstName: 'Nathalie',
        parentLastName: 'Petit',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.parent).toBeDefined();
        expect(res.body.parent.created).toBe(true);
        expect(res.body.parent.loginIdentifier).toBe(parentLoginIdentifier);
        expect(res.body.parent.firstName).toBeUndefined();
        expect(res.body.parent.lastName).toBeUndefined();
        expect(profileServiceClientStub.linkParentToStudent).toHaveBeenCalledWith({
          studentId: res.body.student.id,
          financeOwnerId: res.body.parent.id,
        });
      });
  });

  it("POST /accounts/students with parentAccountMode 'existing' and an unknown parentLoginIdentifier → 404", () => {
    return request(app.getHttpServer())
      .post('/accounts/students')
      .send({
        email: `student-unknownparent-${timestamp}@example.com`,
        password: testPassword,
        firstName: 'Lucas',
        lastName: 'Petit',
        parentAccountMode: 'existing',
        parentLoginIdentifier: `inconnu.${timestamp}`,
      })
      .expect(404);
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
        expect(res.body.firstName).toBeUndefined();
        expect(res.body.lastName).toBeUndefined();
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
        expect(res.body.parent).toBeDefined();
        expect(res.body.parent.email).toBe(parentEmail);
        expect(res.body.parent.role).toBe('parent_financeur');
        expect(res.body.parent.firstName).toBeUndefined();
        expect(res.body.parent.lastName).toBeUndefined();
        expect(res.body.parent.validationStatus).toBe('pending');
        expect(res.body.student).toBeNull();
      });
  });

  it('POST /accounts/parents honours the loginIdentifier chosen by the parent (never derived from the email)', () => {
    const parentEmail = `parent-chosenid-${timestamp}@example.com`;
    const chosenLoginIdentifier = `choisi.par.utilisateur.${timestamp}`;
    return request(app.getHttpServer())
      .post('/accounts/parents')
      .send({
        email: parentEmail,
        password: testPassword,
        firstName: 'Sophie',
        lastName: 'Bernard',
        loginIdentifier: chosenLoginIdentifier,
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.parent.loginIdentifier).toBe(chosenLoginIdentifier);
      });
  });

  it('POST /accounts/parents with student fields but without studentAccountMode → 400', () => {
    const parentEmail = `parent-nomode-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/parents')
      .send({
        email: parentEmail,
        password: testPassword,
        firstName: 'Sophie',
        lastName: 'Bernard',
        studentEmail: `student-nomode-${timestamp}@example.com`,
        studentPassword: testPassword,
        studentFirstName: 'Lucas',
        studentLastName: 'Petit',
      })
      .expect(400);
  });

  it("POST /accounts/parents with studentAccountMode 'new' but without studentLoginIdentifier → 400", () => {
    const parentEmail = `parent-nostudentid-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/parents')
      .send({
        email: parentEmail,
        password: testPassword,
        firstName: 'Sophie',
        lastName: 'Bernard',
        studentAccountMode: 'new',
        studentEmail: `student-noid-${timestamp}@example.com`,
        studentPassword: testPassword,
        studentFirstName: 'Lucas',
        studentLastName: 'Petit',
      })
      .expect(400);
  });

  it("POST /accounts/parents with studentAccountMode 'new' → 201, the student keeps the chosen loginIdentifier and is linked as financed student", () => {
    const parentEmail = `parent-withstudent-${timestamp}@example.com`;
    return request(app.getHttpServer())
      .post('/accounts/parents')
      .send({
        email: parentEmail,
        password: testPassword,
        firstName: 'Sophie',
        lastName: 'Bernard',
        studentAccountMode: 'new',
        studentLoginIdentifier: `choisi.eleve.${timestamp}`,
        studentEmail: `student-named-${timestamp}@example.com`,
        studentPassword: testPassword,
        studentFirstName: 'Lucas',
        studentLastName: 'Petit',
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

  // --- Retrait de consentement (arbitrage du 2026-08-09) ----------------------
  //
  // Cycle complet sur un compte dédié : donner → lire → retirer → relire →
  // redonner. Le journal `consent_records` est append-only, aucune ligne n'est
  // jamais supprimée.

  describe('consent withdrawal', () => {
    const withdrawalLoginIdentifier = `withdraw-${timestamp}`;
    let withdrawalAccessToken: string;

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/accounts')
        .send({
          email: `withdraw-${timestamp}@example.com`,
          password: testPassword,
          loginIdentifier: withdrawalLoginIdentifier,
          consents: [{ consentType: 'rgpd' }, { consentType: 'cgu' }, { consentType: 'marketing' }],
        })
        .expect(201);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ loginIdentifier: withdrawalLoginIdentifier, password: testPassword })
        .expect(201);

      withdrawalAccessToken = loginResponse.body.access_token;
    });

    const authenticated = (httpRequest: request.Test) =>
      httpRequest.set('Authorization', `Bearer ${withdrawalAccessToken}`);

    it('GET /consents → one current state per consent type, mandatory ones not withdrawable', () => {
      return authenticated(request(app.getHttpServer()).get('/consents'))
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(3);
          const marketingState = res.body.find((state) => state.consentType === 'marketing');
          expect(marketingState.status).toBe('granted');
          expect(marketingState.isWithdrawable).toBe(true);
          expect(res.body.find((state) => state.consentType === 'rgpd').isWithdrawable).toBe(false);
          expect(res.body.find((state) => state.consentType === 'cgu').isWithdrawable).toBe(false);
        });
    });

    it('POST /consents/marketing/withdraw → 201, withdrawal appended to the journal', () => {
      return authenticated(request(app.getHttpServer()).post('/consents/marketing/withdraw'))
        .expect(201)
        .expect((res) => {
          expect(res.body.action).toBe('withdrawn');
          expect(res.body.consentType).toBe('marketing');
        });
    });

    it('GET /consents after withdrawal → marketing reads as withdrawn, never as granted', () => {
      return authenticated(request(app.getHttpServer()).get('/consents'))
        .expect(200)
        .expect((res) => {
          const marketingState = res.body.find((state) => state.consentType === 'marketing');
          expect(marketingState.status).toBe('withdrawn');
          expect(marketingState.isGranted).toBe(false);
          expect(marketingState.withdrawnAt).toBeDefined();
          // La preuve que le consentement AVAIT été donné reste accessible.
          expect(marketingState.grantedAt).toBeDefined();
        });
    });

    it('withdrawing marketing never deactivates the account', () => {
      return authenticated(request(app.getHttpServer()).get('/consents'))
        .expect(200)
        .expect((res) => {
          expect(res.body.find((state) => state.consentType === 'rgpd').isGranted).toBe(true);
          expect(res.body.find((state) => state.consentType === 'cgu').isGranted).toBe(true);
        });
    });

    it('POST /consents/marketing/withdraw twice → 409', () => {
      return authenticated(request(app.getHttpServer()).post('/consents/marketing/withdraw'))
        .expect(409)
        .expect((res) => expect(res.body.message).toContain('already withdrawn'));
    });

    it('POST /consents {marketing} after withdrawal → 201, the consent can be granted again', () => {
      return authenticated(request(app.getHttpServer()).post('/consents'))
        .send({ consentType: 'marketing' })
        .expect(201)
        .expect((res) => expect(res.body.action).toBe('granted'));
    });

    it.each(['rgpd', 'cgu'])(
      'POST /consents/%s/withdraw → 403, refused explicitly and pointed to account closure',
      (mandatoryConsentType) => {
        return authenticated(
          request(app.getHttpServer()).post(`/consents/${mandatoryConsentType}/withdraw`),
        )
          .expect(403)
          .expect((res) => expect(res.body.message).toContain('closing the account'));
      },
    );

    it('POST /consents/newsletter/withdraw → 400 on an unknown consent type', () => {
      return authenticated(
        request(app.getHttpServer()).post('/consents/newsletter/withdraw'),
      ).expect(400);
    });

    it('POST /consents/marketing/withdraw without JWT → 401', () => {
      return request(app.getHttpServer()).post('/consents/marketing/withdraw').expect(401);
    });

    it('GET /consents/history → every event kept, grants and withdrawals alike', () => {
      return authenticated(request(app.getHttpServer()).get('/consents/history'))
        .expect(200)
        .expect((res) => {
          const marketingEvents = res.body.filter((event) => event.consentType === 'marketing');
          expect(marketingEvents.map((event) => event.action)).toEqual([
            'granted',
            'withdrawn',
            'granted',
          ]);
          // L'adresse IP est une preuve interne, elle ne part pas vers le client.
          expect(marketingEvents.every((event) => event.ipAddress === undefined)).toBe(true);
        });
    });

    it('POST /consents/marketing/withdraw on an account that never granted it → 404', async () => {
      const neverGrantedLoginIdentifier = `never-marketing-${timestamp}`;
      await request(app.getHttpServer())
        .post('/accounts')
        .send({
          email: `never-marketing-${timestamp}@example.com`,
          password: testPassword,
          loginIdentifier: neverGrantedLoginIdentifier,
          consents: [{ consentType: 'rgpd' }, { consentType: 'cgu' }],
        })
        .expect(201);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ loginIdentifier: neverGrantedLoginIdentifier, password: testPassword })
        .expect(201);

      return request(app.getHttpServer())
        .post('/consents/marketing/withdraw')
        .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
        .expect(404)
        .expect((res) => expect(res.body.message).toContain('never granted it'));
    });
  });
});
