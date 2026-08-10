import { AdministrativeProfile } from './entities/administrative-profile.entity';

/**
 * Préfixe public par défaut de la route de lecture de la photo, tel que le
 * front l'atteint à travers l'api-gateway (`docs/routes.md`). Surchargeable
 * par `AVATAR_PUBLIC_PATH_PREFIX` pour ne pas figer la topologie de la
 * passerelle dans le service.
 */
export const DEFAULT_AVATAR_PUBLIC_PATH_PREFIX = '/api/v1/profiles';

/**
 * Forme EXPOSÉE du profil administratif.
 *
 * Liste blanche assumée, et non un `...profile` : depuis que le service stocke
 * les octets d'une photo, l'entité porte des champs de stockage
 * (`avatarObjectKey`, `avatarContentType`) qui n'ont rien à faire dans une
 * réponse HTTP. Un étalement d'objet les aurait publiés le jour de leur
 * création, sans que personne ne l'ait décidé. Énumérer les champs coûte
 * quelques lignes et rend l'ajout d'un champ interne inoffensif par défaut.
 */
export interface AdministrativeProfileView {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  /**
   * URL de LECTURE de la photo de profil, ou `null` s'il n'y en a pas.
   *
   * Ce n'est plus une adresse saisie par l'utilisateur mais une valeur
   * construite par le serveur, qui pointe vers `GET /profiles/:userId/avatar`.
   * D'où le refus en 400 de ce champ sur
   * `PUT /profiles/:userId/administrative` : l'accepter puis l'ignorer serait
   * exactement le défaut proscrit par `docs/architecture.md`.
   *
   * Le paramètre `?v=` porte l'horodatage du dernier envoi. Il change à chaque
   * remplacement, ce qui invalide le cache du navigateur sans avoir à interdire
   * la mise en cache.
   */
  avatarUrl: string | null;
  department: string | null;
  passions: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * URL de lecture de la photo, `null` quand aucune photo n'est stockée.
 *
 * `avatarUpdatedAt` peut manquer sur une ligne écrite avant l'introduction du
 * champ ; on retombe alors sur `updatedAt`, jamais sur une URL sans jeton de
 * version — sans quoi la toute première photo d'un profil resterait cachée
 * derrière une éventuelle réponse 404 déjà mémorisée.
 */
export function buildAvatarUrl(
  profile: Pick<AdministrativeProfile, 'userId' | 'avatarObjectKey' | 'avatarUpdatedAt' | 'updatedAt'>,
  publicPathPrefix: string = DEFAULT_AVATAR_PUBLIC_PATH_PREFIX,
): string | null {
  if (!profile.avatarObjectKey) return null;

  const versionSource = profile.avatarUpdatedAt ?? profile.updatedAt;
  const version = versionSource ? new Date(versionSource).getTime() : 0;
  return `${publicPathPrefix}/${profile.userId}/avatar?v=${version}`;
}

/**
 * Projette l'entité vers sa forme exposée.
 *
 * Les champs de stockage de la photo sont écartés ici, en un seul endroit :
 * toutes les routes qui renvoient un bloc `administrative` passent par cette
 * fonction, publiques comme `/internal/*`.
 */
export function toAdministrativeProfileView(
  profile: AdministrativeProfile,
  publicPathPrefix: string = DEFAULT_AVATAR_PUBLIC_PATH_PREFIX,
): AdministrativeProfileView {
  return {
    userId: profile.userId,
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
    birthDate: profile.birthDate ?? null,
    phone: profile.phone ?? null,
    addressLine1: profile.addressLine1 ?? null,
    addressLine2: profile.addressLine2 ?? null,
    postalCode: profile.postalCode ?? null,
    city: profile.city ?? null,
    country: profile.country ?? null,
    avatarUrl: buildAvatarUrl(profile, publicPathPrefix),
    department: profile.department ?? null,
    passions: profile.passions ?? null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}
