import {
  PRESCRIPTION_METADATA_FIELDS,
  STRUCTURAL_PROFILE_FIELDS,
  ViewerRelation,
  filterProfileBlock,
  isFieldVisibleTo,
  pedagogicalBlockOf,
} from '../../../src/profiles/profile-visibility-filter';
import {
  FIELD_VISIBILITY_CATALOG,
  FieldAudience,
} from '../../../src/profiles/field-visibility.catalog';

/** Réglages effectifs : défauts du catalogue, dérogations appliquées par-dessus. */
const audiences = (overrides: Record<string, FieldAudience> = {}): Map<string, FieldAudience> =>
  new Map(
    FIELD_VISIBILITY_CATALOG.map((definition) => [
      definition.fieldName,
      overrides[definition.fieldName] ?? definition.defaultAudience,
    ]),
  );

describe('profile-visibility-filter', () => {
  // ---------------------------------------------------------------------------
  // isFieldVisibleTo — la règle nue
  // ---------------------------------------------------------------------------
  describe('isFieldVisibleTo', () => {
    const audienceValues: FieldAudience[] = ['self', 'linked', 'all'];

    it.each(audienceValues)(
      'montre un champ réglé %s au titulaire — on ne se masque jamais ses propres données',
      (audience) => {
        expect(isFieldVisibleTo(audience, 'owner')).toBe(true);
      },
    );

    it.each(audienceValues)(
      'montre un champ réglé %s à un lecteur exempté (parent financeur, administrateurs)',
      (audience) => {
        expect(isFieldVisibleTo(audience, 'exempt')).toBe(true);
      },
    );

    it('cache un champ `self` à un contact lié', () => {
      expect(isFieldVisibleTo('self', 'linked')).toBe(false);
    });

    it('montre un champ `linked` à un contact lié', () => {
      expect(isFieldVisibleTo('linked', 'linked')).toBe(true);
    });

    it('cache un champ `linked` à un utilisateur authentifié sans lien', () => {
      expect(isFieldVisibleTo('linked', 'authenticated')).toBe(false);
    });

    it('montre un champ `all` à un utilisateur authentifié sans lien', () => {
      expect(isFieldVisibleTo('all', 'authenticated')).toBe(true);
    });

    it('cache un champ `self` à un utilisateur authentifié sans lien', () => {
      expect(isFieldVisibleTo('self', 'authenticated')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // filterProfileBlock — bloc administratif
  // ---------------------------------------------------------------------------
  describe('filterProfileBlock — bloc administratif', () => {
    const administrative = {
      userId: 'student-uuid',
      firstName: 'Alice',
      lastName: 'Martin',
      avatarUrl: 'https://example.test/a.png',
      phone: '0600000000',
      birthDate: '2008-05-02',
      city: 'Lyon',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    };

    it('rend le bloc intact au titulaire, sans rien lister comme masqué', () => {
      const result = filterProfileBlock(administrative, 'administrative', audiences(), 'owner');

      expect(result.block).toBe(administrative);
      expect(result.hiddenFieldNames).toEqual([]);
    });

    it('rend le bloc intact à un lecteur exempté', () => {
      const result = filterProfileBlock(administrative, 'administrative', audiences(), 'exempt');

      expect(result.block).toBe(administrative);
      expect(result.hiddenFieldNames).toEqual([]);
    });

    it('cache à un contact lié tout ce qui sort du socle par défaut', () => {
      const result = filterProfileBlock(administrative, 'administrative', audiences(), 'linked');

      // Socle : firstName, lastName, avatarUrl restent visibles.
      expect(result.block).toMatchObject({
        firstName: 'Alice',
        lastName: 'Martin',
        avatarUrl: 'https://example.test/a.png',
      });
      expect(result.hiddenFieldNames).toEqual(['birthDate', 'city', 'phone']);
    });

    it("retire la CLÉ d'un champ masqué au lieu de la neutraliser à null", () => {
      const result = filterProfileBlock(administrative, 'administrative', audiences(), 'linked');

      // Le point qui coûte cher quand on le rate : « masqué » doit être
      // distinguable de « vide ». La clé est absente, pas mise à null.
      expect('phone' in result.block).toBe(false);
      expect(Object.keys(result.block)).not.toContain('phone');
      expect((result.block as Record<string, unknown>).phone).toBeUndefined();
    });

    it('conserve les champs de structure, qui ne sont pas des données personnelles', () => {
      const result = filterProfileBlock(administrative, 'administrative', audiences(), 'linked');

      for (const structural of ['userId', 'createdAt', 'updatedAt']) {
        expect(Object.keys(result.block)).toContain(structural);
      }
      expect(result.hiddenFieldNames).not.toContain('userId');
    });

    it('respecte une dérogation `all` posée par le titulaire sur un champ masqué par défaut', () => {
      const result = filterProfileBlock(
        administrative,
        'administrative',
        audiences({ phone: 'all' }),
        'authenticated',
      );

      expect(result.block).toMatchObject({ phone: '0600000000' });
      expect(result.hiddenFieldNames).not.toContain('phone');
    });

    it('respecte une dérogation `self` posée sur un champ du socle', () => {
      const result = filterProfileBlock(
        administrative,
        'administrative',
        audiences({ firstName: 'self' }),
        'linked',
      );

      expect('firstName' in result.block).toBe(false);
      expect(result.hiddenFieldNames).toContain('firstName');
    });

    it('ne masque aucun champ absent du bloc — pas de faux positif dans hiddenFields', () => {
      const sparse = { userId: 'student-uuid', firstName: 'Alice' };

      const result = filterProfileBlock(sparse, 'administrative', audiences(), 'linked');

      expect(result.hiddenFieldNames).toEqual([]);
      expect(result.block).toEqual(sparse);
    });

    it('laisse passer un champ porté par l\'entité mais absent du catalogue', () => {
      const withExtra = { userId: 'student-uuid', someFutureColumn: 'valeur' };

      const result = filterProfileBlock(withExtra, 'administrative', audiences(), 'linked');

      // Non réglable donc non masquable : le masquer en silence serait pire
      // que de le laisser passer, puisque personne ne pourrait le débloquer.
      expect(result.block).toMatchObject({ someFutureColumn: 'valeur' });
      expect(result.hiddenFieldNames).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // filterProfileBlock — bloc pédagogique élève et prescription
  // ---------------------------------------------------------------------------
  describe('filterProfileBlock — profil pédagogique élève', () => {
    const pedagogical = {
      userId: 'student-uuid',
      level: '3ème',
      subjects: ['maths'],
      goals: 'Progresser en géométrie',
      difficulties: 'Trigonométrie',
      specificNeeds: 'PAP',
      context: 'Famille recomposée',
      generalAssessment: 'Élève sérieux',
      recommendedPace: '2h par semaine',
      filledBy: 'rp-uuid',
      filledAt: new Date('2026-03-01T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    };

    it('laisse au titulaire la totalité de sa fiche, PRESCRIPTION COMPRISE', () => {
      const result = filterProfileBlock(
        pedagogical,
        'pedagogical-student',
        audiences(),
        'owner',
      );

      expect(result.block).toBe(pedagogical);
      expect(result.hiddenFieldNames).toEqual([]);
      // Il lit sa prescription sans pouvoir l'écrire — le filtrage ne doit
      // jamais la lui retirer.
      expect((result.block as Record<string, unknown>).generalAssessment).toBe('Élève sérieux');
    });

    it('ne laisse au formateur lié que le socle level/subjects', () => {
      const result = filterProfileBlock(
        pedagogical,
        'pedagogical-student',
        audiences(),
        'linked',
      );

      expect(result.block).toMatchObject({ level: '3ème', subjects: ['maths'] });
      expect(result.hiddenFieldNames).toEqual(
        expect.arrayContaining([
          'context',
          'difficulties',
          'generalAssessment',
          'goals',
          'recommendedPace',
          'specificNeeds',
        ]),
      );
    });

    it('masque filledBy/filledAt quand aucun champ de prescription n\'est visible', () => {
      const result = filterProfileBlock(
        pedagogical,
        'pedagogical-student',
        audiences(),
        'linked',
      );

      // Les laisser révélerait qu'un RP a prescrit quelque chose, et quand.
      for (const metadata of PRESCRIPTION_METADATA_FIELDS) {
        expect(metadata in result.block).toBe(false);
        expect(result.hiddenFieldNames).toContain(metadata);
      }
    });

    it('rend filledBy/filledAt dès qu\'un champ de prescription est partagé', () => {
      const result = filterProfileBlock(
        pedagogical,
        'pedagogical-student',
        audiences({ generalAssessment: 'linked' }),
        'linked',
      );

      expect(result.block).toMatchObject({ generalAssessment: 'Élève sérieux' });
      for (const metadata of PRESCRIPTION_METADATA_FIELDS) {
        expect(Object.keys(result.block)).toContain(metadata);
        expect(result.hiddenFieldNames).not.toContain(metadata);
      }
    });

    it('renvoie hiddenFields trié, pour une réponse stable d\'un appel à l\'autre', () => {
      const result = filterProfileBlock(
        pedagogical,
        'pedagogical-student',
        audiences(),
        'linked',
      );

      expect(result.hiddenFieldNames).toEqual([...result.hiddenFieldNames].sort());
    });
  });

  // ---------------------------------------------------------------------------
  // filterProfileBlock — bloc pédagogique formateur
  // ---------------------------------------------------------------------------
  describe('filterProfileBlock — profil pédagogique formateur', () => {
    const pedagogical = {
      userId: 'teacher-uuid',
      levels: ['Terminale'],
      subjects: ['maths'],
      experience: '10 ans',
      diplomas: 'Agrégation',
      testResults: '18/20',
      isAnimateurPedagogique: true,
    };

    it('conserve isAnimateurPedagogique : c\'est un droit, pas une déclaration', () => {
      const result = filterProfileBlock(
        pedagogical,
        'pedagogical-teacher',
        audiences(),
        'linked',
      );

      expect(result.block).toMatchObject({ isAnimateurPedagogique: true });
      expect(result.hiddenFieldNames).not.toContain('isAnimateurPedagogique');
      expect(STRUCTURAL_PROFILE_FIELDS).toContain('isAnimateurPedagogique');
    });

    it('masque les résultats de tests et l\'expérience à un contact lié', () => {
      const result = filterProfileBlock(
        pedagogical,
        'pedagogical-teacher',
        audiences(),
        'linked',
      );

      expect(result.hiddenFieldNames).toEqual(
        expect.arrayContaining(['diplomas', 'experience', 'testResults']),
      );
      // `levels` est `self` par défaut (le socle ne porte que `level`/`subjects`).
      expect(result.hiddenFieldNames).toContain('levels');
      expect(result.block).toMatchObject({ subjects: ['maths'] });
    });
  });

  describe('pedagogicalBlockOf', () => {
    it('associe chaque type de profil à son bloc de catalogue', () => {
      expect(pedagogicalBlockOf('student')).toBe('pedagogical-student');
      expect(pedagogicalBlockOf('teacher')).toBe('pedagogical-teacher');
    });
  });

  // ---------------------------------------------------------------------------
  // Garde-fou : aucun champ du catalogue n'échappe à la règle par distraction
  // ---------------------------------------------------------------------------
  describe('couverture du catalogue', () => {
    const relations: ViewerRelation[] = ['owner', 'exempt', 'linked', 'authenticated'];

    it.each(relations)('décide de chaque champ du catalogue pour un lecteur %s', (relation) => {
      for (const definition of FIELD_VISIBILITY_CATALOG) {
        const decision = isFieldVisibleTo(definition.defaultAudience, relation);
        expect(typeof decision).toBe('boolean');
      }
    });

    it('ne partage par défaut que le socle validé le 2026-08-09', () => {
      const sharedByDefault = FIELD_VISIBILITY_CATALOG.filter((definition) =>
        isFieldVisibleTo(definition.defaultAudience, 'linked'),
      ).map((definition) => definition.fieldName);

      expect(sharedByDefault.sort()).toEqual(
        ['avatarUrl', 'firstName', 'lastName', 'level', 'subjects'].sort(),
      );
    });

    it('ne partage aucun champ de prescription par défaut', () => {
      const prescriptionShared = FIELD_VISIBILITY_CATALOG.filter(
        (definition) =>
          definition.isPrescription === true &&
          isFieldVisibleTo(definition.defaultAudience, 'linked'),
      );

      expect(prescriptionShared).toEqual([]);
    });
  });
});
