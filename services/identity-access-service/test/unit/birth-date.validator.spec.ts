import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  BIRTH_DATE_ERROR_MESSAGE,
  isIsoCalendarDate,
} from '../../src/accounts/dto/birth-date.validator';
import { CreateStudentAccountDto } from '../../src/accounts/dto/create-student-account.dto';
import { CreateTeacherAccountDto } from '../../src/accounts/dto/create-teacher-account.dto';
import { CreateParentAccountDto } from '../../src/accounts/dto/create-parent-account.dto';
import { CreateAccountDto } from '../../src/accounts/dto/create-account.dto';
import { collectDeclaredFieldNames } from '../../src/common/guards/reject-unknown-body-fields.guard';

/**
 * `birthDate` était collecté par le formulaire d'inscription élève, envoyé par
 * le front, puis jeté (ValidationPipe `whitelist: true`), laissant
 * administrative_profiles.date_naissance à NULL — le champ avait donc été retiré
 * du formulaire le 2026-08-09. profile-service accepte désormais `birthDate` sur
 * POST /internal/create-administrative-profile : identity-access-service le
 * déclare et le relaie, sans jamais le stocker.
 */
describe('isIsoCalendarDate', () => {
  it.each(['2005-06-15', '2000-02-29', '1999-12-31', '2008-01-01'])(
    'accepts the real calendar date %s',
    (candidate) => {
      expect(isIsoCalendarDate(candidate)).toBe(true);
    },
  );

  it.each([
    '15/06/2005',
    '2005-6-15',
    '05-06-15',
    '2005-06-15T00:00:00.000Z',
    '2005-06-15 ',
    'hier',
    '',
  ])('rejects the malformed value %p', (candidate) => {
    expect(isIsoCalendarDate(candidate)).toBe(false);
  });

  it.each(['2005-02-30', '2005-13-01', '2005-00-10', '2005-06-31', '2001-02-29'])(
    'rejects the impossible date %s instead of letting Date normalise it',
    (candidate) => {
      expect(isIsoCalendarDate(candidate)).toBe(false);
    },
  );

  it('rejects a non-string value', () => {
    expect(isIsoCalendarDate(undefined)).toBe(false);
    expect(isIsoCalendarDate(null)).toBe(false);
    expect(isIsoCalendarDate(20050615)).toBe(false);
    expect(isIsoCalendarDate(new Date())).toBe(false);
  });
});

describe('CreateStudentAccountDto — birthDate', () => {
  const buildStudentBody = (extraFields: Record<string, unknown>) => ({
    email: 'eleve@example.com',
    password: 'password123',
    firstName: 'Lucas',
    lastName: 'Petit',
    ...extraFields,
  });

  it('accepts a valid ISO calendar date', async () => {
    const dto = plainToInstance(CreateStudentAccountDto, buildStudentBody({ birthDate: '2008-05-14' }));
    const errors = await validate(dto);

    expect(errors.find((error) => error.property === 'birthDate')).toBeUndefined();
    expect(dto.birthDate).toBe('2008-05-14');
  });

  it('accepts a body without birthDate — the field stays optional', async () => {
    const dto = plainToInstance(CreateStudentAccountDto, buildStudentBody({}));
    const errors = await validate(dto);

    expect(errors.find((error) => error.property === 'birthDate')).toBeUndefined();
    expect(dto.birthDate).toBeUndefined();
  });

  it('rejects a malformed date with an explicit message naming the expected format', async () => {
    const dto = plainToInstance(CreateStudentAccountDto, buildStudentBody({ birthDate: '14/05/2008' }));
    const errors = await validate(dto);

    const birthDateError = errors.find((error) => error.property === 'birthDate');
    expect(birthDateError).toBeDefined();
    expect(Object.values(birthDateError!.constraints ?? {})).toContain(BIRTH_DATE_ERROR_MESSAGE);
  });

  it('rejects an impossible date rather than forwarding it to profile-service', async () => {
    const dto = plainToInstance(CreateStudentAccountDto, buildStudentBody({ birthDate: '2008-02-30' }));
    const errors = await validate(dto);

    expect(errors.find((error) => error.property === 'birthDate')).toBeDefined();
  });

  it('is seen as an accepted field by the strict body guard', () => {
    expect(collectDeclaredFieldNames(CreateStudentAccountDto).has('birthDate')).toBe(true);
  });

  it('declares no birth date for the linked parent account, which no form collects', () => {
    expect(collectDeclaredFieldNames(CreateStudentAccountDto).has('parentBirthDate')).toBe(false);
    expect(collectDeclaredFieldNames(CreateParentAccountDto).has('studentBirthDate')).toBe(false);
  });
});

describe('birthDate scope — only the route whose form collects it', () => {
  it.each([
    ['CreateAccountDto', CreateAccountDto],
    ['CreateTeacherAccountDto', CreateTeacherAccountDto],
    ['CreateParentAccountDto', CreateParentAccountDto],
  ])('%s does not declare birthDate', (_name, dtoClass) => {
    expect(collectDeclaredFieldNames(dtoClass).has('birthDate')).toBe(false);
  });
});
