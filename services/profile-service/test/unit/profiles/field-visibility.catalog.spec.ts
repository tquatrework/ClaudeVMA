import {
  DEFAULT_LINKED_FIELDS,
  FIELD_VISIBILITY_CATALOG,
  defaultAudienceOf,
  isKnownVisibilityField,
} from '../../../src/profiles/field-visibility.catalog';
import { StudentPedagogicalProfile } from '../../../src/profiles/entities/student-pedagogical-profile.entity';
import { AdministrativeProfile } from '../../../src/profiles/entities/administrative-profile.entity';

/**
 * Le catalogue est la source de vérité de la liste close des champs réglables.
 * Un champ ajouté à une entité sans l'être au catalogue devient invisible pour
 * tout le monde sans que personne ne l'ait décidé ; un champ resté au catalogue
 * après suppression de sa colonne fait apparaître dans l'écran de confidentialité
 * un réglage qui ne porte plus sur rien. Ces tests ferment les deux sens.
 */
describe('Catalogue de visibilité des champs de profil', () => {
  const namesOfBlock = (block: string) =>
    FIELD_VISIBILITY_CATALOG.filter((definition) => definition.block === block).map(
      (definition) => definition.fieldName,
    );

  describe('champs des formulaires élève ajoutés le 2026-08-11', () => {
    const newStudentFields = [
      'schoolName',
      'familyContext',
      'schoolContext',
      'equipment',
    ] as const;

    it.each(newStudentFields)('%s figure au catalogue, bloc pédagogique élève', (fieldName) => {
      expect(isKnownVisibilityField(fieldName)).toBe(true);
      expect(namesOfBlock('pedagogical-student')).toContain(fieldName);
    });

    it.each(newStudentFields)('%s est masqué par défaut (hors socle)', (fieldName) => {
      // Situation familiale, situation scolaire et équipement du domicile sont
      // sensibles ; le nom de l'établissement d'un mineur permet de le localiser.
      expect(defaultAudienceOf(fieldName)).toBe('self');
      expect(DEFAULT_LINKED_FIELDS as readonly string[]).not.toContain(fieldName);
    });

    it('les quatre champs existent sur l’entité élève', () => {
      // Vérification À LA COMPILATION, et non à l'exécution : les propriétés
      // d'une entité TypeORM ne sont pas initialisées, `Object.keys` sur une
      // instance neuve renvoie donc un tableau vide et ne prouverait rien.
      // Ce `Pick` ne compile que si les quatre champs sont bien déclarés.
      const probe: Pick<
        StudentPedagogicalProfile,
        'schoolName' | 'familyContext' | 'schoolContext' | 'equipment'
      > = {
        schoolName: 'Lycée Montaigne',
        familyContext: 'Une sœur jumelle',
        schoolContext: 'Redoublement en seconde',
        equipment: 'Ordinateur partagé, webcam',
      };

      expect(Object.keys(probe).sort()).toEqual([
        'equipment',
        'familyContext',
        'schoolContext',
        'schoolName',
      ]);
    });
  });

  describe('champs retirés le 2026-08-11', () => {
    it('`context` a quitté le catalogue en même temps que sa colonne', () => {
      expect(isKnownVisibilityField('context')).toBe(false);
      expect(namesOfBlock('pedagogical-student')).not.toContain('context');
    });

    it('`department` a quitté le catalogue en même temps que sa colonne', () => {
      expect(isKnownVisibilityField('department')).toBe(false);
      expect(namesOfBlock('administrative')).not.toContain('department');
    });

    it('ni `context` ni `department` ne subsistent sur les entités', () => {
      // Là encore le verrou est À LA COMPILATION : `@ts-expect-error` échoue si
      // la propriété venait à réapparaître, donc si l'erreur attendue disparaît.
      const student = {} as StudentPedagogicalProfile;
      // @ts-expect-error `context` a été remplacé par familyContext/schoolContext.
      const removedContext = student.context;

      const administrative = {} as AdministrativeProfile;
      // @ts-expect-error `department` a été retiré du profil administratif.
      const removedDepartment = administrative.department;

      expect(removedContext).toBeUndefined();
      expect(removedDepartment).toBeUndefined();
    });
  });

  it('le socle reste limité aux cinq champs validés le 2026-08-09', () => {
    // Garde-fou : ajouter un champ au socle élargit ce que TOUT contact lié voit
    // par défaut, sur TOUS les profils existants. Ce n'est jamais un effet de bord.
    expect([...DEFAULT_LINKED_FIELDS]).toEqual([
      'firstName',
      'lastName',
      'avatarUrl',
      'level',
      'subjects',
    ]);
  });

  it('aucun nom de champ n’est déclaré deux fois', () => {
    const names = FIELD_VISIBILITY_CATALOG.map((definition) => definition.fieldName);
    expect(new Set(names).size).toBe(names.length);
  });
});
