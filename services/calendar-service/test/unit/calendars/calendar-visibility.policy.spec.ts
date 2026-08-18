import {
  resolveCalendarBusyFreeAccess,
  isCalendarBusyFreeAccessAllowed,
} from '../../../src/calendars/calendar-visibility.policy';
import { RelationKind } from '../../../src/common/relations/relation-kind';
import { UserRole } from '../../../src/common/enums/user-role.enum';

describe('resolveCalendarBusyFreeAccess', () => {
  it('grants "owner" when the viewer is the calendar owner, regardless of role', () => {
    const position = resolveCalendarBusyFreeAccess({
      viewerId: 'user-1',
      viewerRole: UserRole.ELEVE,
      ownerId: 'user-1',
      ownerRole: UserRole.ELEVE,
      relations: [],
    });
    expect(position).toBe('owner');
  });

  it('grants "administrator" to RP on a student calendar without any relation', () => {
    const position = resolveCalendarBusyFreeAccess({
      viewerId: 'rp-1',
      viewerRole: UserRole.RESPONSABLE_PEDAGOGIQUE,
      ownerId: 'student-1',
      ownerRole: UserRole.ELEVE,
      relations: [],
    });
    expect(position).toBe('administrator');
  });

  it('grants "administrator" to RP on a teacher calendar without any relation', () => {
    const position = resolveCalendarBusyFreeAccess({
      viewerId: 'rp-1',
      viewerRole: UserRole.RESPONSABLE_PEDAGOGIQUE,
      ownerId: 'teacher-1',
      ownerRole: UserRole.FORMATEUR,
      relations: [],
    });
    expect(position).toBe('administrator');
  });

  it.each([UserRole.ADMINISTRATEUR_FINANCIER, UserRole.TECHNICIEN_INFORMATIQUE])(
    'denies %s on a student calendar without a relation (RP-only admin scope)',
    (role) => {
      const position = resolveCalendarBusyFreeAccess({
        viewerId: 'admin-1',
        viewerRole: role,
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        relations: [],
      });
      expect(position).toBe('denied');
    },
  );

  it.each([UserRole.ADMINISTRATEUR_FINANCIER, UserRole.TECHNICIEN_INFORMATIQUE])(
    'denies %s on a teacher calendar without a relation (RP-only admin scope)',
    (role) => {
      const position = resolveCalendarBusyFreeAccess({
        viewerId: 'admin-1',
        viewerRole: role,
        ownerId: 'teacher-1',
        ownerRole: UserRole.FORMATEUR,
        relations: [],
      });
      expect(position).toBe('denied');
    },
  );

  describe('titulaire élève', () => {
    it('grants "linked" for a parent financeur (FINANCE_OWNER_OF_STUDENT)', () => {
      const position = resolveCalendarBusyFreeAccess({
        viewerId: 'parent-1',
        viewerRole: UserRole.PARENT_FINANCEUR,
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        relations: [{ kind: RelationKind.FINANCE_OWNER_OF_STUDENT }],
      });
      expect(position).toBe('linked');
    });

    it('grants "linked" for an active teacher (TEACHER_OF_STUDENT)', () => {
      const position = resolveCalendarBusyFreeAccess({
        viewerId: 'teacher-1',
        viewerRole: UserRole.FORMATEUR,
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        relations: [{ kind: RelationKind.TEACHER_OF_STUDENT }],
      });
      expect(position).toBe('linked');
    });

    it('denies an AP with ANIMATOR_OF_TEACHER only (wrong relation kind for a student owner)', () => {
      const position = resolveCalendarBusyFreeAccess({
        viewerId: 'ap-1',
        viewerRole: UserRole.ANIMATEUR_PEDAGOGIQUE,
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        relations: [{ kind: RelationKind.ANIMATOR_OF_TEACHER }],
      });
      expect(position).toBe('denied');
    });

    it('denies an unlinked teacher (no relation at all)', () => {
      const position = resolveCalendarBusyFreeAccess({
        viewerId: 'teacher-2',
        viewerRole: UserRole.FORMATEUR,
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        relations: [],
      });
      expect(position).toBe('denied');
    });
  });

  describe('titulaire formateur', () => {
    it('grants "linked" for a linked student (STUDENT_OF_TEACHER)', () => {
      const position = resolveCalendarBusyFreeAccess({
        viewerId: 'student-1',
        viewerRole: UserRole.ELEVE,
        ownerId: 'teacher-1',
        ownerRole: UserRole.FORMATEUR,
        relations: [{ kind: RelationKind.STUDENT_OF_TEACHER }],
      });
      expect(position).toBe('linked');
    });

    it('grants "linked" for an indirect parent (FINANCE_OWNER_OF_STUDENT_OF_TEACHER)', () => {
      const position = resolveCalendarBusyFreeAccess({
        viewerId: 'parent-1',
        viewerRole: UserRole.PARENT_FINANCEUR,
        ownerId: 'teacher-1',
        ownerRole: UserRole.FORMATEUR,
        relations: [
          { kind: RelationKind.FINANCE_OWNER_OF_STUDENT_OF_TEACHER, throughUserIds: ['student-1'] },
        ],
      });
      expect(position).toBe('linked');
    });

    it('grants "linked" for a linked AP (ANIMATOR_OF_TEACHER)', () => {
      const position = resolveCalendarBusyFreeAccess({
        viewerId: 'ap-1',
        viewerRole: UserRole.ANIMATEUR_PEDAGOGIQUE,
        ownerId: 'teacher-1',
        ownerRole: UserRole.FORMATEUR,
        relations: [{ kind: RelationKind.ANIMATOR_OF_TEACHER }],
      });
      expect(position).toBe('linked');
    });

    it('denies a parent with FINANCE_OWNER_OF_STUDENT only (wrong relation kind for a teacher owner)', () => {
      const position = resolveCalendarBusyFreeAccess({
        viewerId: 'parent-1',
        viewerRole: UserRole.PARENT_FINANCEUR,
        ownerId: 'teacher-1',
        ownerRole: UserRole.FORMATEUR,
        relations: [{ kind: RelationKind.FINANCE_OWNER_OF_STUDENT }],
      });
      expect(position).toBe('denied');
    });

    it('denies an unlinked AP (no relation at all) — bug fix: no more free pass', () => {
      const position = resolveCalendarBusyFreeAccess({
        viewerId: 'ap-2',
        viewerRole: UserRole.ANIMATEUR_PEDAGOGIQUE,
        ownerId: 'teacher-1',
        ownerRole: UserRole.FORMATEUR,
        relations: [],
      });
      expect(position).toBe('denied');
    });
  });

  it('denies everyone but the owner and RP when ownerRole is unknown (calendar never created, fail closed)', () => {
    const position = resolveCalendarBusyFreeAccess({
      viewerId: 'teacher-1',
      viewerRole: UserRole.FORMATEUR,
      ownerId: 'student-1',
      ownerRole: undefined,
      relations: [{ kind: RelationKind.TEACHER_OF_STUDENT }],
    });
    expect(position).toBe('denied');
  });

  it('still grants RP when ownerRole is unknown', () => {
    const position = resolveCalendarBusyFreeAccess({
      viewerId: 'rp-1',
      viewerRole: UserRole.RESPONSABLE_PEDAGOGIQUE,
      ownerId: 'student-1',
      ownerRole: undefined,
      relations: [],
    });
    expect(position).toBe('administrator');
  });

  it('denies everyone with a role/owner combination outside the student/teacher matrix', () => {
    const position = resolveCalendarBusyFreeAccess({
      viewerId: 'someone',
      viewerRole: UserRole.FORMATEUR,
      ownerId: 'parent-1',
      ownerRole: UserRole.PARENT_FINANCEUR,
      relations: [{ kind: RelationKind.TEACHER_OF_STUDENT }],
    });
    expect(position).toBe('denied');
  });
});

describe('isCalendarBusyFreeAccessAllowed', () => {
  it.each(['owner', 'administrator', 'linked'] as const)('allows position %s', (position) => {
    expect(isCalendarBusyFreeAccessAllowed(position)).toBe(true);
  });

  it('denies position "denied"', () => {
    expect(isCalendarBusyFreeAccessAllowed('denied')).toBe(false);
  });
});
