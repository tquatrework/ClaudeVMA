import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  buildAvatarUrl,
  toAdministrativeProfileView,
} from '../../../src/profiles/administrative-profile.view';
import { AdministrativeProfile } from '../../../src/profiles/entities/administrative-profile.entity';
import { UpdateAdministrativeProfileDto } from '../../../src/profiles/dto/update-administrative-profile.dto';
import { FIELD_VISIBILITY_CATALOG } from '../../../src/profiles/field-visibility.catalog';

const USER_ID = '11111111-1111-4111-8111-111111111111';

const makeProfile = (overrides: Partial<AdministrativeProfile> = {}): AdministrativeProfile =>
  ({
    userId: USER_ID,
    firstName: 'Alice',
    lastName: 'Martin',
    avatarObjectKey: null,
    avatarContentType: null,
    avatarUpdatedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-02-02T00:00:00Z'),
    ...overrides,
  }) as AdministrativeProfile;

describe('Projection du profil administratif', () => {
  describe('toAdministrativeProfileView', () => {
    it('n’expose JAMAIS les champs de stockage de la photo', () => {
      const view = toAdministrativeProfileView(
        makeProfile({
          avatarObjectKey: 'avatars/55555555-5555-4555-8555-555555555555.webp',
          avatarContentType: 'image/webp',
          avatarUpdatedAt: new Date('2026-08-10T10:00:00Z'),
        }),
      );

      expect(view).not.toHaveProperty('avatarObjectKey');
      expect(view).not.toHaveProperty('avatarContentType');
      expect(view).not.toHaveProperty('avatarUpdatedAt');
      expect(JSON.stringify(view)).not.toContain('avatars/');
    });

    it('expose tous les champs du catalogue de visibilité du bloc administratif', () => {
      // Sans cette garantie, un champ pourrait devenir invisible pour tout le
      // monde sans que personne ne l'ait réglé : le filtrage ne masque que ce
      // qui est présent sur l'objet qu'il reçoit.
      const view = toAdministrativeProfileView(makeProfile());
      const catalogFieldNames = FIELD_VISIBILITY_CATALOG.filter(
        (definition) => definition.block === 'administrative' && !definition.isReserved,
      ).map((definition) => definition.fieldName);

      for (const fieldName of catalogFieldNames) {
        expect(Object.keys(view)).toContain(fieldName);
      }
    });

    it('normalise les champs non renseignés à null, jamais à undefined', () => {
      // « Clé présente à null » = non renseigné ; « clé absente » = masqué.
      // La distinction ne tient que si les champs vides restent des clés.
      const view = toAdministrativeProfileView(makeProfile());

      expect(view.phone).toBeNull();
      expect(view.city).toBeNull();
      expect(view.avatarUrl).toBeNull();
    });
  });

  describe('buildAvatarUrl', () => {
    it('renvoie null quand aucune photo n’est stockée', () => {
      expect(buildAvatarUrl(makeProfile())).toBeNull();
    });

    it('porte un jeton de version tiré de l’horodatage du dernier envoi', () => {
      const avatarUpdatedAt = new Date('2026-08-10T10:00:00Z');
      const url = buildAvatarUrl(
        makeProfile({ avatarObjectKey: 'avatars/a.webp', avatarUpdatedAt }),
      );

      expect(url).toBe(`/api/v1/profiles/${USER_ID}/avatar?v=${avatarUpdatedAt.getTime()}`);
    });

    it('change de jeton quand la photo est remplacée — sinon le cache la garde', () => {
      const first = buildAvatarUrl(
        makeProfile({
          avatarObjectKey: 'avatars/a.webp',
          avatarUpdatedAt: new Date('2026-08-10T10:00:00Z'),
        }),
      );
      const second = buildAvatarUrl(
        makeProfile({
          avatarObjectKey: 'avatars/b.webp',
          avatarUpdatedAt: new Date('2026-08-10T11:00:00Z'),
        }),
      );

      expect(first).not.toBe(second);
    });

    it('ne laisse jamais transparaître la clé d’objet dans l’URL', () => {
      const url = buildAvatarUrl(
        makeProfile({
          avatarObjectKey: 'avatars/55555555-5555-4555-8555-555555555555.webp',
          avatarUpdatedAt: new Date(),
        }),
      );

      expect(url).not.toContain('55555555-5555-4555-8555-555555555555');
      expect(url).not.toContain('.webp');
    });

    it('retombe sur updatedAt quand l’horodatage de photo manque', () => {
      const profile = makeProfile({ avatarObjectKey: 'avatars/a.webp', avatarUpdatedAt: null });

      expect(buildAvatarUrl(profile)).toContain(`v=${profile.updatedAt.getTime()}`);
    });

    it('respecte un préfixe public surchargé', () => {
      const url = buildAvatarUrl(
        makeProfile({ avatarObjectKey: 'avatars/a.webp', avatarUpdatedAt: new Date(0) }),
        '/gateway/profiles',
      );

      expect(url).toBe(`/gateway/profiles/${USER_ID}/avatar?v=0`);
    });
  });
});

describe('UpdateAdministrativeProfileDto — avatarUrl géré par l’application', () => {
  const validateBody = (body: Record<string, unknown>) =>
    validate(plainToInstance(UpdateAdministrativeProfileDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

  it('refuse avatarUrl et explique par où passer', async () => {
    const errors = await validateBody({ avatarUrl: 'https://cdn.example.test/photo.jpg' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('avatarUrl');
    expect(Object.values(errors[0].constraints ?? {}).join(' ')).toMatch(
      /POST \/profiles\/:userId\/avatar/,
    );
  });

  it('refuse aussi avatarUrl à null — effacer est une modification comme une autre', async () => {
    const errors = await validateBody({ avatarUrl: null });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('avatarUrl');
  });

  it('laisse passer un corps qui ne mentionne pas avatarUrl', async () => {
    expect(await validateBody({ firstName: 'Alice', city: 'Paris' })).toHaveLength(0);
  });
});
