import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  checkRegistrationConsents,
  MAX_REGISTRATION_CONSENTS,
} from '../../src/accounts/dto/registration-consents';
import { CreateStudentAccountDto } from '../../src/accounts/dto/create-student-account.dto';
import { ConsentType } from '../../src/consents/entities/consent-record.entity';

/**
 * Contrat du champ `consents` des routes de création de compte : même forme que
 * le corps de POST /consents, un élément par consentement recueilli.
 */
describe('checkRegistrationConsents', () => {
  it('accepts an absent consents field (account simply stays PENDING)', () => {
    expect(checkRegistrationConsents(undefined)).toEqual([]);
  });

  it('accepts an empty list', () => {
    expect(checkRegistrationConsents([])).toEqual([]);
  });

  it('accepts the nominal registration case: rgpd + cgu', () => {
    expect(
      checkRegistrationConsents([
        { consentType: ConsentType.RGPD },
        { consentType: ConsentType.CGU },
      ]),
    ).toEqual([]);
  });

  it('accepts an explicit version alongside the consent type', () => {
    expect(checkRegistrationConsents([{ consentType: ConsentType.RGPD, version: '2.1' }])).toEqual([]);
  });

  it('rejects a consent type sent twice', () => {
    const violations = checkRegistrationConsents([
      { consentType: ConsentType.RGPD },
      { consentType: ConsentType.RGPD, version: '2.0' },
    ]);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('duplicated consentType(s): rgpd');
  });

  it('lists every duplicated consent type, not just the first one', () => {
    const violations = checkRegistrationConsents([
      { consentType: ConsentType.RGPD },
      { consentType: ConsentType.CGU },
      { consentType: ConsentType.RGPD },
      { consentType: ConsentType.CGU },
    ]);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('rgpd');
    expect(violations[0]).toContain('cgu');
  });
});

describe('CreateStudentAccountDto — consents field validation', () => {
  const buildStudentPayload = (consents: unknown) => ({
    email: 'eleve@example.com',
    password: 'password123',
    firstName: 'Lucas',
    lastName: 'Petit',
    consents,
  });

  it('accepts a well-formed consents array', async () => {
    const dto = plainToInstance(
      CreateStudentAccountDto,
      buildStudentPayload([{ consentType: 'rgpd' }, { consentType: 'cgu', version: '1.0' }]),
    );

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown consent type', async () => {
    const dto = plainToInstance(CreateStudentAccountDto, buildStudentPayload([{ consentType: 'newsletter' }]));

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('consents');
  });

  it('rejects a boolean map — the shape the front used to send', async () => {
    const dto = plainToInstance(CreateStudentAccountDto, buildStudentPayload({ rgpd: true, cgu: true }));

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('consents');
  });

  it('rejects more entries than there are consent types', async () => {
    const tooManyConsents = Array.from({ length: MAX_REGISTRATION_CONSENTS + 1 }, () => ({
      consentType: 'rgpd',
    }));
    const dto = plainToInstance(CreateStudentAccountDto, buildStudentPayload(tooManyConsents));

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('consents');
  });

  it('accepts a payload without consents at all', async () => {
    const dto = plainToInstance(CreateStudentAccountDto, {
      email: 'eleve@example.com',
      password: 'password123',
      firstName: 'Lucas',
      lastName: 'Petit',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
