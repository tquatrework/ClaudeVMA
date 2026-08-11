import {
  ADMINISTRATOR_ROLES,
  isAdministrator,
  resolveStatisticsViewerPosition,
} from '../../../src/relations/pedagogical-access.policy';
import { RelationKind, ResolvedRelation } from '../../../src/relations/relation-kind';
import { UserRole } from '../../../src/common/enums/user-role.enum';

const position = (input: {
  viewerRole: UserRole;
  relations?: ResolvedRelation[];
  viewerId?: string;
  targetId?: string;
}) =>
  resolveStatisticsViewerPosition({
    viewerId: input.viewerId ?? 'viewer',
    viewerRole: input.viewerRole,
    targetId: input.targetId ?? 'target',
    relations: input.relations ?? [],
  });

describe('pedagogical-access.policy', () => {
  describe('isAdministrator', () => {
    it('reconnaît RP, AF et TI — sans distinction pour l\'instant (arbitrage 2026-08-11)', () => {
      expect(ADMINISTRATOR_ROLES).toEqual([
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        UserRole.ADMINISTRATEUR_FINANCIER,
        UserRole.TECHNICIEN_INFORMATIQUE,
      ]);
      for (const role of ADMINISTRATOR_ROLES) {
        expect(isAdministrator(role)).toBe(true);
      }
    });

    it("ne compte PAS l'animateur pédagogique parmi les administrateurs", () => {
      expect(isAdministrator(UserRole.ANIMATEUR_PEDAGOGIQUE)).toBe(false);
      expect(isAdministrator(UserRole.FORMATEUR)).toBe(false);
      expect(isAdministrator(UserRole.ELEVE)).toBe(false);
      expect(isAdministrator(UserRole.PARENT_FINANCEUR)).toBe(false);
      expect(isAdministrator(undefined)).toBe(false);
    });
  });

  describe('resolveStatisticsViewerPosition', () => {
    it('le titulaire est owner, quel que soit son rôle', () => {
      expect(position({ viewerRole: UserRole.ELEVE, viewerId: 'x', targetId: 'x' })).toBe('owner');
      expect(position({ viewerRole: UserRole.FORMATEUR, viewerId: 'x', targetId: 'x' })).toBe('owner');
    });

    it('les administrateurs voient tout le monde, sans relation', () => {
      for (const role of ADMINISTRATOR_ROLES) {
        expect(position({ viewerRole: role })).toBe('exempt');
      }
    });

    it('refuse quiconque n\'a aucune relation — y compris un AP sans lien', () => {
      expect(position({ viewerRole: UserRole.ANIMATEUR_PEDAGOGIQUE })).toBe('denied');
      expect(position({ viewerRole: UserRole.FORMATEUR })).toBe('denied');
      expect(position({ viewerRole: UserRole.PARENT_FINANCEUR })).toBe('denied');
      expect(position({ viewerRole: UserRole.ELEVE })).toBe('denied');
    });

    it('le parent financeur DIRECT est exempté du filtrage sur son élève', () => {
      expect(
        position({
          viewerRole: UserRole.PARENT_FINANCEUR,
          relations: [{ kind: RelationKind.FINANCE_OWNER_OF_STUDENT }],
        }),
      ).toBe('exempt');
    });

    it("le parent n'est PAS exempté sur le formateur de son élève — il y est simplement lié", () => {
      expect(
        position({
          viewerRole: UserRole.PARENT_FINANCEUR,
          relations: [
            { kind: RelationKind.FINANCE_OWNER_OF_STUDENT_OF_TEACHER, throughUserIds: ['s'] },
          ],
        }),
      ).toBe('linked');
    });

    it("l'AP est exempté sur le formateur qu'il anime", () => {
      expect(
        position({
          viewerRole: UserRole.ANIMATEUR_PEDAGOGIQUE,
          relations: [{ kind: RelationKind.ANIMATOR_OF_TEACHER }],
        }),
      ).toBe('exempt');
    });

    it('formateur → son élève et élève → son formateur : liés, donc filtrés', () => {
      expect(
        position({
          viewerRole: UserRole.FORMATEUR,
          relations: [{ kind: RelationKind.TEACHER_OF_STUDENT, isPrincipalTeacher: true }],
        }),
      ).toBe('linked');
      expect(
        position({
          viewerRole: UserRole.ELEVE,
          relations: [{ kind: RelationKind.STUDENT_OF_TEACHER }],
        }),
      ).toBe('linked');
    });

    it('le professeur principal ne bénéficie d\'aucune exemption — question non tranchée', () => {
      expect(
        position({
          viewerRole: UserRole.FORMATEUR,
          relations: [{ kind: RelationKind.TEACHER_OF_STUDENT, isPrincipalTeacher: true }],
        }),
      ).toBe('linked');
    });

    it("l'élève relié à son parent financeur est lié, pas exempté", () => {
      expect(
        position({
          viewerRole: UserRole.ELEVE,
          relations: [{ kind: RelationKind.STUDENT_OF_FINANCE_OWNER }],
        }),
      ).toBe('linked');
    });
  });
});
