import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { Actor } from '../common/types/actor.type';
import { EventsService } from '../events/events.service';
import { ImageTranscoder } from '../media/image-transcoder';
import { MediaConfig } from '../media/media.config';
import { MEDIA_STORAGE_PORT, MediaObjectKey, MediaStoragePort } from '../media/media-storage.port';
import { AdministrativeProfile } from './entities/administrative-profile.entity';
import { FieldVisibilityService } from './field-visibility.service';
import { ProfilesService } from './profiles.service';
import { isFieldVisibleTo } from './profile-visibility-filter';

/** Dossier logique des photos de profil dans le stockage des médias. */
const AVATAR_KEY_FOLDER = 'avatars';

/** Nom du champ de visibilité sous lequel la photo est réglable. */
const AVATAR_FIELD_NAME = 'avatarUrl';

/**
 * Message unique pour « pas de photo » ET « photo masquée pour vous ».
 *
 * Ce n'est pas de la paresse mais la condition pour que le 404 ne soit pas
 * bavard : deux messages distincts rétabliraient exactement ce que le 404
 * cherche à éviter, à savoir révéler l'existence d'une photo qu'on n'a pas le
 * droit de voir.
 */
const AVATAR_NOT_AVAILABLE_MESSAGE = 'Aucune photo de profil disponible pour cet utilisateur';

export interface AvatarUploadResult {
  /** URL de lecture versionnée, à réutiliser telle quelle par le client. */
  avatarUrl: string;
}

export interface AvatarBytes {
  bytes: Buffer;
  contentType: string;
  /** Sert à construire l'ETag et à dater la ressource. */
  updatedAt: Date;
}

/**
 * Photo de profil : envoi, lecture des octets, suppression.
 *
 * DROIT D'ÉCRITURE — LE TITULAIRE SEUL.
 * Volontairement plus strict que `assertWriteAccess`, qui ouvre l'écriture du
 * profil administratif au RP, au TI et à l'AF. Le raisonnement de
 * `docs/architecture.md` est que chaque rôle administratif écrit DANS SON
 * DOMAINE ; or la photo de profil n'appartient au domaine d'aucun d'eux. Le
 * parent financeur lit tout mais n'écrit rien, la règle est explicite. Et le
 * TI dispose déjà de `POST /admin/visibility-overrides` pour masquer une photo
 * problématique sans avoir à la remplacer. Tout autre appelant : 403.
 *
 * DROIT DE LECTURE — LE MÊME QUE POUR LE CHAMP `avatarUrl`.
 * La lecture emprunte les ports de `ProfilesService` (`assertReadAccess` puis
 * `resolveViewerRelation`) et le catalogue de visibilité, exactement comme le
 * bloc `administrative` de `GET /profiles/:userId`. Une route d'octets qui
 * refiltrerait à sa façon serait le contournement du filtrage, pas son
 * application.
 *
 * MASQUÉ ⇒ 404, JAMAIS 403.
 * Cohérent avec le choix déjà tenu par le filtrage champ par champ : « un
 * champ masqué est ABSENT de la réponse ». Un 403 dirait « il y a bien une
 * photo, mais elle ne vous est pas destinée » — soit précisément
 * l'information que le titulaire a choisi de ne pas partager. Le 404 dit la
 * même chose qu'une absence de photo, et c'est voulu.
 */
@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

  constructor(
    @InjectRepository(AdministrativeProfile)
    private readonly adminRepo: Repository<AdministrativeProfile>,
    @Inject(MEDIA_STORAGE_PORT)
    private readonly mediaStorage: MediaStoragePort,
    private readonly imageTranscoder: ImageTranscoder,
    private readonly mediaConfig: MediaConfig,
    private readonly profilesService: ProfilesService,
    private readonly fieldVisibilityService: FieldVisibilityService,
    private readonly events: EventsService,
  ) {}

  /**
   * Envoie (ou remplace) la photo de profil.
   *
   * Enchaînement, dans cet ordre précis :
   *  1. droit d'écriture — le titulaire seul ;
   *  2. plafond de taille sur les octets REÇUS ;
   *  3. détection du format sur les octets réels + ré-encodage WebP, ce qui
   *     supprime au passage les métadonnées EXIF ;
   *  4. écriture sous une clé NEUVE, générée côté serveur ;
   *  5. enregistrement en base ;
   *  6. suppression de l'ancien fichier — seulement une fois la base à jour.
   *
   * L'ordre 4-5-6 n'est pas indifférent. Écrire d'abord le nouveau fichier,
   * puis la base, puis effacer l'ancien garantit qu'à aucun instant la base ne
   * référence un fichier absent : au pire un fichier orphelin subsiste si le
   * processus meurt entre 5 et 6, ce qui coûte quelques kilo-octets et
   * n'empêche personne d'afficher sa photo. L'ordre inverse aurait produit,
   * lui, un profil dont la photo ne se charge plus.
   */
  async uploadAvatar(
    userId: string,
    file: { buffer: Buffer; size: number; originalname?: string; mimetype?: string } | undefined,
    actor: Actor,
  ): Promise<AvatarUploadResult> {
    this.assertAvatarWriteAccess(userId, actor);

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException(
        'Aucun fichier reçu. Envoyez l’image dans un formulaire multipart, sous le champ « file ».',
      );
    }

    if (file.buffer.length > this.mediaConfig.maxUploadBytes) {
      throw new PayloadTooLargeException(
        `L’image dépasse la taille maximale autorisée (${formatMebibytes(this.mediaConfig.maxUploadBytes)}).`,
      );
    }

    // Le profil administratif est obligatoire (arbitrage du 2026-08-07) : son
    // absence est une incohérence de données, jamais un cas à rattraper par une
    // création à la volée.
    const profile = await this.adminRepo.findOne({ where: { userId } });
    if (!profile) {
      this.logger.error(
        `ANOMALIE DE DONNEES : envoi de photo pour userId=${userId} sans profil administratif. ` +
          'Le profil administratif est obligatoire et créé à l’inscription ; aucune création à la ' +
          'volée n’est faite ici.',
      );
      throw new InternalServerErrorException(
        `Profil administratif introuvable pour userId=${userId}`,
      );
    }

    // Le nom du fichier envoyé n'est JAMAIS repris : ni son extension, ni son
    // Content-Type, ni son nom. Tout est décidé par le serveur.
    const transcoded = await this.imageTranscoder.transcodeToAvatar(file.buffer);
    const previousObjectKey = profile.avatarObjectKey;
    const objectKey = buildAvatarObjectKey(transcoded.extension);

    await this.mediaStorage.save(objectKey, transcoded.bytes);

    profile.avatarObjectKey = objectKey;
    profile.avatarContentType = transcoded.contentType;
    profile.avatarUpdatedAt = new Date();
    const saved = await this.adminRepo.save(profile);

    if (previousObjectKey && previousObjectKey !== objectKey) {
      // Le remplacement DOIT effacer l'ancien fichier, sinon le volume enfle
      // d'une image à chaque changement de photo. L'échec de cette suppression
      // ne doit pas faire échouer un envoi par ailleurs réussi : il est journalisé.
      await this.mediaStorage.delete(previousObjectKey).catch((error: unknown) => {
        this.logger.error(
          `Ancienne photo non supprimée (userId=${userId}, objectKey=${previousObjectKey}) : ` +
            `${error instanceof Error ? error.message : String(error)}. ` +
            'Le fichier reste sur le volume et devra être nettoyé.',
        );
      });
    }

    this.events.publish('ProfileUpdated', {
      userId,
      actorId: actor.id,
      section: 'administrative',
      field: AVATAR_FIELD_NAME,
    });

    // L'URL est construite par le MÊME projecteur que `GET /profiles/:userId`.
    // Deux constructions séparées finiraient par diverger d'un préfixe ou d'un
    // jeton de version, et le client ne saurait plus laquelle croire.
    const { avatarUrl } = this.profilesService.presentAdministrativeProfile(saved);
    return { avatarUrl: avatarUrl as string };
  }

  /**
   * Renvoie les OCTETS de la photo, après application des mêmes règles de
   * lecture que le champ `avatarUrl` du profil.
   *
   * Trois issues, et une seule visible du lecteur non autorisé :
   *  - aucun lien avec le titulaire → 403 (`assertReadAccess`), comme pour le
   *    profil : on ne cache pas qu'un profil existe, seulement son contenu ;
   *  - champ masqué pour ce lecteur → 404, indiscernable de « pas de photo » ;
   *  - pas de photo → 404, même message.
   */
  async getAvatarBytes(userId: string, actor: Actor): Promise<AvatarBytes> {
    await this.profilesService.assertReadAccess(userId, actor);

    const profile = await this.adminRepo.findOne({ where: { userId } });
    if (!profile?.avatarObjectKey) {
      throw new NotFoundException(AVATAR_NOT_AVAILABLE_MESSAGE);
    }

    const relation = await this.profilesService.resolveViewerRelation(userId, actor);
    if (relation !== 'owner' && relation !== 'exempt') {
      const audience = await this.fieldVisibilityService.resolveAudience(userId, AVATAR_FIELD_NAME);
      if (!isFieldVisibleTo(audience, relation)) {
        throw new NotFoundException(AVATAR_NOT_AVAILABLE_MESSAGE);
      }
    }

    const bytes = await this.mediaStorage.read(profile.avatarObjectKey);
    if (!bytes) {
      // La base référence un objet que le stockage n'a pas : volume non monté,
      // restauration partielle, fichier effacé à la main. Anomalie journalisée,
      // et 404 côté client — mieux vaut « pas de photo » qu'une 500 sur une
      // page de profil par ailleurs valide.
      this.logger.error(
        `ANOMALIE DE STOCKAGE : le profil userId=${userId} référence objectKey=` +
          `${profile.avatarObjectKey}, absent du stockage des médias. Vérifier le montage du ` +
          'volume media_data.',
      );
      throw new NotFoundException(AVATAR_NOT_AVAILABLE_MESSAGE);
    }

    return {
      bytes,
      contentType: profile.avatarContentType ?? 'application/octet-stream',
      updatedAt: profile.avatarUpdatedAt ?? profile.updatedAt,
    };
  }

  /**
   * Supprime la photo de profil : la ligne en base ET le fichier sur le volume.
   *
   * IDEMPOTENT. Supprimer une photo déjà absente répond `204`, pas `404` :
   * l'état visé — « ce profil n'a pas de photo » — est atteint. Ce n'est pas
   * un champ accepté puis ignoré (ce que `docs/architecture.md` proscrit), mais
   * la sémantique normale de DELETE ; un double clic sur « Supprimer » ne doit
   * pas produire d'erreur.
   *
   * La base est mise à jour AVANT le fichier : si le processus meurt entre les
   * deux, il reste un fichier orphelin, jamais une référence morte.
   */
  async deleteAvatar(userId: string, actor: Actor): Promise<void> {
    this.assertAvatarWriteAccess(userId, actor);

    const profile = await this.adminRepo.findOne({ where: { userId } });
    if (!profile?.avatarObjectKey) return;

    const objectKey = profile.avatarObjectKey;
    profile.avatarObjectKey = null;
    profile.avatarContentType = null;
    profile.avatarUpdatedAt = null;
    await this.adminRepo.save(profile);

    await this.mediaStorage.delete(objectKey).catch((error: unknown) => {
      this.logger.error(
        `Photo supprimée en base mais pas sur le volume (userId=${userId}, objectKey=${objectKey}) : ` +
          `${error instanceof Error ? error.message : String(error)}. Fichier à nettoyer.`,
      );
    });

    this.events.publish('ProfileUpdated', {
      userId,
      actorId: actor.id,
      section: 'administrative',
      field: AVATAR_FIELD_NAME,
    });
  }

  /**
   * Le titulaire, et personne d'autre.
   *
   * Aucune exception administrative : voir l'en-tête de classe. Le message est
   * en français et dit par où passer, plutôt que de constater un refus.
   */
  private assertAvatarWriteAccess(userId: string, actor: Actor): void {
    if (actor.id === userId) return;

    throw new ForbiddenException(
      'Seul le titulaire du profil peut modifier ou supprimer sa photo de profil.',
    );
  }
}

/**
 * Clé d'objet d'une photo : dossier fixe, UUID généré par le serveur,
 * extension issue du RÉ-ENCODAGE.
 *
 * Rien de ce que l'appelant a envoyé n'entre ici. Un nom de fichier fourni par
 * le client est une entrée hostile classique (`../../etc/passwd`,
 * `photo.php.jpg`, nom de 4 000 caractères) ; le plus simple est de ne jamais
 * s'en servir.
 */
export function buildAvatarObjectKey(extension: string): MediaObjectKey {
  return `${AVATAR_KEY_FOLDER}/${randomUUID()}.${extension}`;
}

/** Formate un plafond d'octets en Mio, pour un message lisible par l'utilisateur. */
function formatMebibytes(bytes: number): string {
  const mebibytes = bytes / (1024 * 1024);
  const rounded = Number.isInteger(mebibytes) ? mebibytes : Math.round(mebibytes * 10) / 10;
  return `${rounded} Mo`;
}

export { AVATAR_FIELD_NAME, AVATAR_NOT_AVAILABLE_MESSAGE };
