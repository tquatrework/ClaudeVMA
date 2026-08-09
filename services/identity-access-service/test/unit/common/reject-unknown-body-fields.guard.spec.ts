import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RejectUnknownBodyFieldsGuard,
  STRICT_BODY_DTO,
  collectDeclaredFieldNames,
} from '../../../src/common/guards/reject-unknown-body-fields.guard';
import { CreateStudentAccountDto } from '../../../src/accounts/dto/create-student-account.dto';
import { CreateAccountDto } from '../../../src/accounts/dto/create-account.dto';
import { CreateTeacherAccountDto } from '../../../src/accounts/dto/create-teacher-account.dto';
import { CreateParentAccountDto } from '../../../src/accounts/dto/create-parent-account.dto';

class DtoWithoutDecorators {}

const buildExecutionContext = (requestBody: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ body: requestBody }) }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  }) as unknown as ExecutionContext;

describe('collectDeclaredFieldNames', () => {
  it('lists every field declared by the student registration DTO', () => {
    const declaredFieldNames = collectDeclaredFieldNames(CreateStudentAccountDto);

    expect([...declaredFieldNames].sort()).toEqual(
      [
        'consents',
        'email',
        'firstName',
        'isMember',
        'lastName',
        'loginIdentifier',
        'parentAccountMode',
        'parentEmail',
        'parentFirstName',
        'parentLastName',
        'parentLoginIdentifier',
        'parentPassword',
        'password',
        'phoneNumber',
      ].sort(),
    );
  });

  it('exposes consents on all four account creation DTOs', () => {
    for (const dtoClass of [
      CreateAccountDto,
      CreateStudentAccountDto,
      CreateTeacherAccountDto,
      CreateParentAccountDto,
    ]) {
      expect(collectDeclaredFieldNames(dtoClass).has('consents')).toBe(true);
    }
  });

  it('never exposes a consent field for the linked account (a consent is personal)', () => {
    expect(collectDeclaredFieldNames(CreateStudentAccountDto).has('parentConsents')).toBe(false);
    expect(collectDeclaredFieldNames(CreateParentAccountDto).has('studentConsents')).toBe(false);
  });

  it('throws rather than accepting anything when the DTO declares no validated property', () => {
    expect(() => collectDeclaredFieldNames(DtoWithoutDecorators)).toThrow(
      /declares no class-validator decorated property/,
    );
  });
});

describe('RejectUnknownBodyFieldsGuard', () => {
  let guard: RejectUnknownBodyFieldsGuard;
  let reflector: { get: jest.Mock };

  beforeEach(() => {
    reflector = { get: jest.fn().mockReturnValue(CreateStudentAccountDto) };
    guard = new RejectUnknownBodyFieldsGuard(reflector as unknown as Reflector);
  });

  it('lets a body made only of declared fields through', () => {
    const context = buildExecutionContext({
      email: 'eleve@example.com',
      password: 'password123',
      firstName: 'Lucas',
      lastName: 'Petit',
      consents: [{ consentType: 'rgpd' }, { consentType: 'cgu' }],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects birthDate, which belongs to profile-service and used to be dropped in silence', () => {
    const context = buildExecutionContext({
      email: 'eleve@example.com',
      password: 'password123',
      firstName: 'Lucas',
      lastName: 'Petit',
      birthDate: '2008-05-14',
    });

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
    expect(() => guard.canActivate(context)).toThrow(/birthDate/);
  });

  it('rejects a consent field aimed at the linked account', () => {
    const context = buildExecutionContext({
      email: 'eleve@example.com',
      password: 'password123',
      parentConsents: [{ consentType: 'rgpd' }],
    });

    expect(() => guard.canActivate(context)).toThrow(/parentConsents/);
  });

  it('lists every unknown field at once, and the accepted ones', () => {
    const context = buildExecutionContext({
      email: 'eleve@example.com',
      birthDate: '2008-05-14',
      nickname: 'Lulu',
    });

    try {
      guard.canActivate(context);
      fail('the guard should have rejected the request');
    } catch (rejection) {
      const message = (rejection as BadRequestException).message;
      expect(message).toContain('birthDate');
      expect(message).toContain('nickname');
      expect(message).toContain('Accepted fields for this route');
    }
  });

  it('does nothing on a route that did not opt in', () => {
    reflector.get.mockReturnValue(undefined);

    expect(guard.canActivate(buildExecutionContext({ anything: 'goes' }))).toBe(true);
  });

  it('ignores a non-object body instead of crashing', () => {
    expect(guard.canActivate(buildExecutionContext(undefined))).toBe(true);
    expect(guard.canActivate(buildExecutionContext('raw string'))).toBe(true);
    expect(guard.canActivate(buildExecutionContext([{ email: 'x' }]))).toBe(true);
  });

  it('reads the DTO from the handler metadata key', () => {
    const context = buildExecutionContext({ email: 'eleve@example.com' });

    guard.canActivate(context);

    expect(reflector.get).toHaveBeenCalledWith(STRICT_BODY_DTO, expect.any(Function));
  });
});
