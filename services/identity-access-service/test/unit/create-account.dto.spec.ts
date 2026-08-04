import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAccountDto } from '../../src/accounts/dto/create-account.dto';
import { CreateStudentAccountDto } from '../../src/accounts/dto/create-student-account.dto';
import { CreateTeacherAccountDto } from '../../src/accounts/dto/create-teacher-account.dto';
import { CreateParentAccountDto } from '../../src/accounts/dto/create-parent-account.dto';

/**
 * firstName/lastName sont obligatoires à l'inscription (0/15 comptes en base
 * n'avaient ni prénom ni nom faute de collecte côté route). Ces tests couvrent
 * la validation de forme portée par les DTO pour les quatre routes de création
 * de compte, y compris le cas conditionnel parentFirstName/parentLastName.
 */
describe('Create account DTOs — firstName/lastName validation', () => {
  const expectNoErrorsOn = async (properties: string[], errors: import('class-validator').ValidationError[]) => {
    for (const property of properties) {
      expect(errors.find((error) => error.property === property)).toBeUndefined();
    }
  };

  describe('CreateAccountDto', () => {
    it('passes validation with valid firstName and lastName', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
      });
      const errors = await validate(dto);
      await expectNoErrorsOn(['firstName', 'lastName'], errors);
    });

    it('fails validation when firstName is missing', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        lastName: 'Dupont',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'firstName')).toBeDefined();
    });

    it('fails validation when lastName is missing', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Jean',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'lastName')).toBeDefined();
    });

    it('fails validation when firstName is an empty string', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: '',
        lastName: 'Dupont',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'firstName')).toBeDefined();
    });

    it('fails validation when lastName exceeds 100 characters', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'a'.repeat(101),
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'lastName')).toBeDefined();
    });
  });

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

    it('fails validation when parentEmail is provided without parentFirstName/parentLastName', async () => {
      const dto = plainToInstance(CreateStudentAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        parentEmail: 'parent@example.com',
        parentPassword: 'parentpass123',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'parentFirstName')).toBeDefined();
      expect(errors.find((error) => error.property === 'parentLastName')).toBeDefined();
    });

    it('passes validation when parentEmail is provided with parentFirstName and parentLastName', async () => {
      const dto = plainToInstance(CreateStudentAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        parentEmail: 'parent@example.com',
        parentPassword: 'parentpass123',
        parentFirstName: 'Nathalie',
        parentLastName: 'Petit',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('fails validation when parentEmail is provided with only parentFirstName', async () => {
      const dto = plainToInstance(CreateStudentAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        parentEmail: 'parent@example.com',
        parentFirstName: 'Nathalie',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'parentLastName')).toBeDefined();
    });
  });
});
