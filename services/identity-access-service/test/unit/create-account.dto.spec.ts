import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAccountDto } from '../../src/accounts/dto/create-account.dto';
import { CreateStudentAccountDto } from '../../src/accounts/dto/create-student-account.dto';
import { CreateTeacherAccountDto } from '../../src/accounts/dto/create-teacher-account.dto';
import { CreateParentAccountDto } from '../../src/accounts/dto/create-parent-account.dto';

/**
 * firstName/lastName sont obligatoires à l'inscription (0/15 comptes en base
 * n'avaient ni prénom ni nom faute de collecte côté route, session du
 * 2026-08-04). phoneNumber est un champ optionnel ajouté le 2026-08-05.
 * Depuis cette même date, ni firstName/lastName ni phoneNumber ne sont
 * persistés localement par identity-access-service : ils sont transmis à
 * profile-service (validation de forme inchangée, seule la destination du
 * stockage change — voir AccountsService.persistAdministrativeProfile).
 * Ces tests couvrent la validation de forme portée par les DTO pour les
 * quatre routes de création de compte, y compris les cas conditionnels
 * parentFirstName/parentLastName et studentFirstName/studentLastName.
 */
describe('Create account DTOs — firstName/lastName/phoneNumber validation', () => {
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

    it('passes validation without phoneNumber (optional field)', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
      });
      const errors = await validate(dto);
      await expectNoErrorsOn(['phoneNumber'], errors);
    });

    it('passes validation with a valid international phoneNumber', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
        phoneNumber: '+33 6 01 02 03 04',
      });
      const errors = await validate(dto);
      await expectNoErrorsOn(['phoneNumber'], errors);
    });

    it('passes validation with a valid local phoneNumber', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
        phoneNumber: '06 01 02 03 04',
      });
      const errors = await validate(dto);
      await expectNoErrorsOn(['phoneNumber'], errors);
    });

    it('fails validation when phoneNumber contains letters', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
        phoneNumber: 'not-a-phone-number!!',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'phoneNumber')).toBeDefined();
    });

    it('fails validation when phoneNumber is too short', async () => {
      const dto = plainToInstance(CreateAccountDto, {
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
        phoneNumber: '06',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'phoneNumber')).toBeDefined();
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

    it('fails validation when studentEmail is provided without studentFirstName/studentLastName', async () => {
      const dto = plainToInstance(CreateParentAccountDto, {
        email: 'parent@example.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
        studentEmail: 'eleve@example.com',
        studentPassword: 'studentpass123',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'studentFirstName')).toBeDefined();
      expect(errors.find((error) => error.property === 'studentLastName')).toBeDefined();
    });

    it('passes validation when studentEmail is provided with studentFirstName and studentLastName', async () => {
      const dto = plainToInstance(CreateParentAccountDto, {
        email: 'parent@example.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
        studentEmail: 'eleve@example.com',
        studentPassword: 'studentpass123',
        studentFirstName: 'Lucas',
        studentLastName: 'Petit',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('fails validation when studentEmail is provided with only studentFirstName', async () => {
      const dto = plainToInstance(CreateParentAccountDto, {
        email: 'parent@example.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
        studentEmail: 'eleve@example.com',
        studentFirstName: 'Lucas',
      });
      const errors = await validate(dto);
      expect(errors.find((error) => error.property === 'studentLastName')).toBeDefined();
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
