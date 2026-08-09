import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateStudentAccountDto } from '../../src/accounts/dto/create-student-account.dto';
import { CreateTeacherAccountDto } from '../../src/accounts/dto/create-teacher-account.dto';
import { CreateParentAccountDto } from '../../src/accounts/dto/create-parent-account.dto';
import { LinkedAccountMode } from '../../src/accounts/dto/linked-account-mode';

/**
 * firstName/lastName sont obligatoires à l'inscription (0/15 comptes en base
 * n'avaient ni prénom ni nom faute de collecte côté route, session du
 * 2026-08-04). phoneNumber est un champ optionnel ajouté le 2026-08-05.
 * Depuis cette même date, ni firstName/lastName ni phoneNumber ne sont
 * persistés localement par identity-access-service : ils sont transmis à
 * profile-service (validation de forme inchangée, seule la destination du
 * stockage change — voir AccountsService.persistAdministrativeProfile).
 * Ces tests couvrent la validation de forme portée par les DTO pour les
 * trois routes d'auto-inscription directe par rôle (students/teachers/parents),
 * y compris les cas conditionnels parentFirstName/parentLastName et
 * studentFirstName/studentLastName. La route générique `POST /accounts`
 * (CreateAccountDto) ne collecte pas ces champs — voir create-account.dto.ts.
 */
describe('Create account DTOs — firstName/lastName/phoneNumber validation', () => {
  const expectNoErrorsOn = async (properties: string[], errors: import('class-validator').ValidationError[]) => {
    for (const property of properties) {
      expect(errors.find((error) => error.property === property)).toBeUndefined();
    }
  };

  describe('CreateTeacherAccountDto', () => {
    it('passes validation with valid firstName and lastName', async () => {
      const dto = plainToInstance(CreateTeacherAccountDto, {
        email: 'formateur@example.com',
        password: 'password123',
        firstName: 'Marie',
        lastName: 'Martin',
      });
      const errors = await validate(dto);
      await expectNoErrorsOn(['firstName', 'lastName'], errors);
    });

    it('fails validation when firstName or lastName is missing', async () => {
      const dto = plainToInstance(CreateTeacherAccountDto, {
        email: 'formateur@example.com',
        password: 'password123',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'firstName')).toBeDefined();
      expect(errors.find((error) => error.property === 'lastName')).toBeDefined();
    });

    it('passes validation with a valid phoneNumber', async () => {
      const dto = plainToInstance(CreateTeacherAccountDto, {
        email: 'formateur@example.com',
        password: 'password123',
        firstName: 'Marie',
        lastName: 'Martin',
        phoneNumber: '+33 6 01 02 03 04',
      });
      const errors = await validate(dto);
      await expectNoErrorsOn(['phoneNumber'], errors);
    });
  });

  describe('CreateParentAccountDto', () => {
    it('passes validation with valid firstName and lastName', async () => {
      const dto = plainToInstance(CreateParentAccountDto, {
        email: 'parent@example.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
      });
      const errors = await validate(dto);
      await expectNoErrorsOn(['firstName', 'lastName'], errors);
    });

    it('fails validation when firstName or lastName is missing', async () => {
      const dto = plainToInstance(CreateParentAccountDto, {
        email: 'parent@example.com',
        password: 'password123',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'firstName')).toBeDefined();
      expect(errors.find((error) => error.property === 'lastName')).toBeDefined();
    });

    it('does not require studentFirstName/studentLastName when studentEmail is absent', async () => {
      const dto = plainToInstance(CreateParentAccountDto, {
        email: 'parent@example.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
      });
      const errors = await validate(dto);
      await expectNoErrorsOn(['studentFirstName', 'studentLastName'], errors);
    });

    it('accepts a chosen loginIdentifier for the parent account itself', async () => {
      const dto = plainToInstance(CreateParentAccountDto, {
        email: 'parent@example.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
        loginIdentifier: 'sophie.bernard',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.loginIdentifier).toBe('sophie.bernard');
    });

    it('rejects a loginIdentifier shorter than 3 characters', async () => {
      const dto = plainToInstance(CreateParentAccountDto, {
        email: 'parent@example.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
        loginIdentifier: 'ab',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'loginIdentifier')).toBeDefined();
    });

    it("passes validation with studentAccountMode 'new' and all the creation fields", async () => {
      const dto = plainToInstance(CreateParentAccountDto, {
        email: 'parent@example.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
        studentAccountMode: LinkedAccountMode.NEW,
        studentLoginIdentifier: 'lucas.petit',
        studentEmail: 'eleve@example.com',
        studentPassword: 'studentpass123',
        studentFirstName: 'Lucas',
        studentLastName: 'Petit',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects an unknown studentAccountMode value', async () => {
      const dto = plainToInstance(CreateParentAccountDto, {
        email: 'parent@example.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
        studentAccountMode: 'peut-etre',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'studentAccountMode')).toBeDefined();
    });
  });

  describe('CreateStudentAccountDto', () => {
    it('passes validation with valid student firstName/lastName and no parent fields', async () => {
      const dto = plainToInstance(CreateStudentAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('fails validation when student firstName or lastName is missing', async () => {
      const dto = plainToInstance(CreateStudentAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'firstName')).toBeDefined();
      expect(errors.find((error) => error.property === 'lastName')).toBeDefined();
    });

    it('does not require parentFirstName/parentLastName when parentEmail is absent', async () => {
      const dto = plainToInstance(CreateStudentAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
      });
      const errors = await validate(dto);
      await expectNoErrorsOn(['parentFirstName', 'parentLastName'], errors);
    });

    it("passes validation with parentAccountMode 'new' and all the creation fields", async () => {
      const dto = plainToInstance(CreateStudentAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        parentAccountMode: LinkedAccountMode.NEW,
        parentLoginIdentifier: 'nathalie.petit',
        parentEmail: 'parent@example.com',
        parentPassword: 'parentpass123',
        parentFirstName: 'Nathalie',
        parentLastName: 'Petit',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it("passes validation with parentAccountMode 'existing' and a parentLoginIdentifier only", async () => {
      const dto = plainToInstance(CreateStudentAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        parentAccountMode: LinkedAccountMode.EXISTING,
        parentLoginIdentifier: 'nathalie.petit',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects an unknown parentAccountMode value', async () => {
      const dto = plainToInstance(CreateStudentAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        parentAccountMode: 'peut-etre',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'parentAccountMode')).toBeDefined();
    });

    it('rejects a parentLoginIdentifier shorter than 3 characters', async () => {
      const dto = plainToInstance(CreateStudentAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        parentAccountMode: LinkedAccountMode.EXISTING,
        parentLoginIdentifier: 'ab',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'parentLoginIdentifier')).toBeDefined();
    });

    it('passes validation with a valid phoneNumber', async () => {
      const dto = plainToInstance(CreateStudentAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        phoneNumber: '+33 6 01 02 03 04',
      });
      const errors = await validate(dto);
      await expectNoErrorsOn(['phoneNumber'], errors);
    });
  });
});
