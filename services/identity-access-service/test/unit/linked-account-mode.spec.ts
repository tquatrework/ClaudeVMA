import { LinkedAccountMode, checkLinkedAccountIntent } from '../../src/accounts/dto/linked-account-mode';

/**
 * Intention de liaison d'un second compte à l'inscription (arbitrage
 * d'architecture du 2026-08-09) : rattacher un compte existant et créer un
 * compte lié sont deux intentions distinctes, portées par
 * `parentAccountMode` / `studentAccountMode`. Aucun champ transmis n'est jamais
 * ignoré en silence.
 */
describe('checkLinkedAccountIntent', () => {
  describe("mode absent ou 'none'", () => {
    it('accepts an intent with no linked account field at all', () => {
      expect(checkLinkedAccountIntent('parent', {})).toEqual([]);
    });

    it("accepts an explicit 'none' mode with no field", () => {
      expect(checkLinkedAccountIntent('parent', { mode: LinkedAccountMode.NONE })).toEqual([]);
    });

    it('rejects linked account fields sent without a mode', () => {
      const violations = checkLinkedAccountIntent('parent', {
        email: 'parent@example.com',
        firstName: 'Nathalie',
        lastName: 'Petit',
      });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain('parentAccountMode is required');
      expect(violations[0]).toContain('parentEmail');
      expect(violations[0]).toContain('parentFirstName');
    });

    it("rejects linked account fields sent with mode 'none'", () => {
      const violations = checkLinkedAccountIntent('student', {
        mode: LinkedAccountMode.NONE,
        loginIdentifier: 'lucas.petit',
      });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain('studentAccountMode is required');
    });

    it('ignores blank strings — a whitespace-only field is not a provided field', () => {
      expect(checkLinkedAccountIntent('parent', { email: '   ', firstName: '' })).toEqual([]);
    });
  });

  describe("mode 'existing' — rattacher un compte deja inscrit", () => {
    it('accepts a login identifier alone', () => {
      expect(
        checkLinkedAccountIntent('parent', {
          mode: LinkedAccountMode.EXISTING,
          loginIdentifier: 'nathalie.petit',
        }),
      ).toEqual([]);
    });

    it('rejects a missing login identifier', () => {
      const violations = checkLinkedAccountIntent('parent', { mode: LinkedAccountMode.EXISTING });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain('parentLoginIdentifier is required');
    });

    it('rejects creation fields that would have no effect', () => {
      const violations = checkLinkedAccountIntent('student', {
        mode: LinkedAccountMode.EXISTING,
        loginIdentifier: 'lucas.petit',
        email: 'eleve@example.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
      });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain('studentEmail');
      expect(violations[0]).toContain('studentPassword');
      expect(violations[0]).toContain('studentFirstName');
      expect(violations[0]).toContain('studentLastName');
      expect(violations[0]).toContain('must not be sent');
    });

    it('reports both violations when the identifier is missing and creation fields are sent', () => {
      const violations = checkLinkedAccountIntent('parent', {
        mode: LinkedAccountMode.EXISTING,
        email: 'parent@example.com',
      });
      expect(violations).toHaveLength(2);
    });
  });

  describe("mode 'new' — creer le compte lie", () => {
    it('accepts a complete creation intent', () => {
      expect(
        checkLinkedAccountIntent('parent', {
          mode: LinkedAccountMode.NEW,
          loginIdentifier: 'nathalie.petit',
          email: 'parent@example.com',
          firstName: 'Nathalie',
          lastName: 'Petit',
        }),
      ).toEqual([]);
    });

    it('accepts a creation intent without password (the creator password is reused)', () => {
      expect(
        checkLinkedAccountIntent('student', {
          mode: LinkedAccountMode.NEW,
          loginIdentifier: 'lucas.petit',
          email: 'eleve@example.com',
          firstName: 'Lucas',
          lastName: 'Petit',
        }),
      ).toEqual([]);
    });

    it('rejects a creation intent without a chosen login identifier', () => {
      const violations = checkLinkedAccountIntent('parent', {
        mode: LinkedAccountMode.NEW,
        email: 'parent@example.com',
        firstName: 'Nathalie',
        lastName: 'Petit',
      });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain('parentLoginIdentifier is required');
      expect(violations[0]).toContain('never derived');
    });

    it('lists every missing field of a creation intent', () => {
      const violations = checkLinkedAccountIntent('student', { mode: LinkedAccountMode.NEW });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain('studentLoginIdentifier');
      expect(violations[0]).toContain('studentEmail');
      expect(violations[0]).toContain('studentFirstName');
      expect(violations[0]).toContain('studentLastName');
      expect(violations[0]).toContain('are required');
    });
  });
});
