import {
  resolveArchiveViewerPosition,
  isArchiveReadAllowed,
} from '../../../src/archive/pedagogical-archive-access.policy';
import { RelationKind, RelationSnapshot } from '../../../src/common/relations/relation-kind';

/**
 * La correspondance `kind` → autorisé/refusé est LA règle métier de ce lot.
 * Elle est testée ici sur la fonction pure, chaque valeur de l'énumération
 * étant couverte : un `kind` ajouté plus tard sans décision explicite se
 * traduira par un échec, pas par une ouverture silencieuse.
 */

const VIEWER_ID = 'viewer-uuid';
const TARGET_ID = 'target-uuid';

function snapshot(overrides: Partial<RelationSnapshot> = {}): RelationSnapshot {
  return {
    viewerId: VIEWER_ID,
    targetId: TARGET_ID,
    isSelf: false,
    isAdministrator: false,
    relations: [],
    ...overrides,
  };
}

describe('resolveArchiveViewerPosition', () => {
  describe('titulaire et administrateurs', () => {
    it('le titulaire accède à ses propres archives', () => {
      const position = resolveArchiveViewerPosition(
        snapshot({ viewerId: TARGET_ID, isSelf: true }),
      );

      expect(position).toBe('owner');
      expect(isArchiveReadAllowed(position)).toBe(true);
    });

    it('un administrateur (RP, AF, TI) accède aux archives de tout le monde', () => {
      const position = resolveArchiveViewerPosition(snapshot({ isAdministrator: true }));

      expect(position).toBe('administrator');
      expect(isArchiveReadAllowed(position)).toBe(true);
    });

    it('un administrateur reste autorisé même sans aucune relation', () => {
      const position = resolveArchiveViewerPosition(
        snapshot({ isAdministrator: true, relations: [] }),
      );

      expect(isArchiveReadAllowed(position)).toBe(true);
    });
  });

  describe('relations qui OUVRENT les archives — celui qui accompagne lit celui qui est accompagné', () => {
    it.each([
      ['le formateur sur son élève', RelationKind.TEACHER_OF_STUDENT],
      ['le parent financeur sur son élève', RelationKind.FINANCE_OWNER_OF_STUDENT],
      ['l\'AP sur le formateur qu\'il anime', RelationKind.ANIMATOR_OF_TEACHER],
      ['le coordinateur sur l\'élève qu\'il coordonne', RelationKind.COORDINATOR_OF_STUDENT],
    ])('autorise %s', (_label, kind) => {
      const position = resolveArchiveViewerPosition(snapshot({ relations: [{ kind }] }));

      expect(position).toBe('linked');
      expect(isArchiveReadAllowed(position)).toBe(true);
    });

    it('autorise dès qu\'UNE relation ouvrante figure parmi plusieurs', () => {
      const position = resolveArchiveViewerPosition(
        snapshot({
          relations: [
            { kind: RelationKind.STUDENT_OF_TEACHER },
            { kind: RelationKind.TEACHER_OF_STUDENT, isPrincipalTeacher: true },
          ],
        }),
      );

      expect(isArchiveReadAllowed(position)).toBe(true);
    });
  });

  describe('relations qui N\'OUVRENT PAS les archives — le sens inverse est refusé', () => {
    it('REFUSE à l\'élève les archives de SON formateur (student_of_teacher)', () => {
      const position = resolveArchiveViewerPosition(
        snapshot({ relations: [{ kind: RelationKind.STUDENT_OF_TEACHER, isPrincipalTeacher: true }] }),
      );

      expect(position).toBe('denied');
      expect(isArchiveReadAllowed(position)).toBe(false);
    });

    it('REFUSE au parent les archives du formateur de son élève (finance_owner_of_student_of_teacher)', () => {
      const position = resolveArchiveViewerPosition(
        snapshot({
          relations: [
            {
              kind: RelationKind.FINANCE_OWNER_OF_STUDENT_OF_TEACHER,
              throughUserIds: ['eleve-uuid'],
            },
          ],
        }),
      );

      expect(position).toBe('denied');
    });

    it.each([
      ['l\'élève sur son parent financeur', RelationKind.STUDENT_OF_FINANCE_OWNER],
      ['le formateur sur l\'AP qui l\'anime', RelationKind.TEACHER_OF_ANIMATOR],
      ['l\'élève sur son coordinateur', RelationKind.STUDENT_OF_COORDINATOR],
      [
        'le formateur sur le parent de son élève',
        RelationKind.TEACHER_OF_STUDENT_OF_FINANCE_OWNER,
      ],
    ])('refuse %s', (_label, kind) => {
      expect(resolveArchiveViewerPosition(snapshot({ relations: [{ kind }] }))).toBe('denied');
    });

    it('refuse plusieurs relations non ouvrantes cumulées', () => {
      const position = resolveArchiveViewerPosition(
        snapshot({
          relations: [
            { kind: RelationKind.STUDENT_OF_TEACHER },
            { kind: RelationKind.STUDENT_OF_FINANCE_OWNER },
          ],
        }),
      );

      expect(position).toBe('denied');
    });
  });

  describe('absence de relation', () => {
    it('refuse quand aucune relation ne lie les deux personnes', () => {
      expect(resolveArchiveViewerPosition(snapshot({ relations: [] }))).toBe('denied');
    });

    it('l\'AP sans lien animator_of_teacher ne voit les archives de personne', () => {
      // isAdministrator vaut FALSE pour l'AP côté profile-service : son droit
      // passe entièrement par la relation, jamais par son rôle.
      const position = resolveArchiveViewerPosition(
        snapshot({ isAdministrator: false, relations: [] }),
      );

      expect(position).toBe('denied');
    });
  });

  describe('exhaustivité de l\'énumération', () => {
    it('chaque valeur de RelationKind a une décision explicite', () => {
      const decisions = Object.values(RelationKind).map((kind) => [
        kind,
        resolveArchiveViewerPosition(snapshot({ relations: [{ kind }] })),
      ]);

      expect(Object.fromEntries(decisions)).toEqual({
        [RelationKind.TEACHER_OF_STUDENT]: 'linked',
        [RelationKind.FINANCE_OWNER_OF_STUDENT]: 'linked',
        [RelationKind.ANIMATOR_OF_TEACHER]: 'linked',
        [RelationKind.COORDINATOR_OF_STUDENT]: 'linked',
        [RelationKind.STUDENT_OF_TEACHER]: 'denied',
        [RelationKind.STUDENT_OF_FINANCE_OWNER]: 'denied',
        [RelationKind.TEACHER_OF_ANIMATOR]: 'denied',
        [RelationKind.STUDENT_OF_COORDINATOR]: 'denied',
        [RelationKind.FINANCE_OWNER_OF_STUDENT_OF_TEACHER]: 'denied',
        [RelationKind.TEACHER_OF_STUDENT_OF_FINANCE_OWNER]: 'denied',
      });
    });
  });
});
