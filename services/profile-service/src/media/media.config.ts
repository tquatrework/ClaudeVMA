import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Racine de stockage par défaut — volume nommé `media_data` (docker-compose.yml). */
const DEFAULT_STORAGE_PATH = '/app/storage/media';

/**
 * 1 000 000 octets — plafond d'entrée par défaut, aligné sur docker-compose.yml.
 *
 * POURQUOI CETTE VALEUR PRÉCISE, ET PAS UN COMPTE ROND EN MIO.
 *
 * Le reverse-proxy `nginx-global` placé devant le service ne déclare aucun
 * `client_max_body_size`. Son défaut de **1 Mio (1 048 576 octets)** s'applique
 * donc, et il porte sur le CORPS ENTIER de la requête — enveloppe multipart,
 * frontières et en-têtes de partie comprises — pas seulement sur les octets du
 * fichier. Au-delà, nginx répond un `413` **en HTML** sans jamais transmettre
 * la requête : le service ne voit rien, le front reçoit une page qu'il ne sait
 * pas lire, l'utilisateur n'obtient aucun message exploitable.
 *
 * Fixer le plafond applicatif à 1 000 000 (1 Mo au sens SI) laisse ~48 Ko sous
 * celui de nginx : de quoi absorber l'enveloppe multipart, et surtout garantir
 * que **le refus vienne toujours de l'application**, avec un corps JSON
 * structuré. Un plafond réglé à 1 Mio pile aurait laissé une bande de quelques
 * kilo-octets où le fichier passe le contrôle applicatif mais où l'enveloppe
 * fait dépasser nginx — soit exactement la panne muette qu'on cherche à éviter.
 *
 * Ce n'est PAS la limite souhaitable à terme : une photo de téléphone pèse
 * couramment 2 à 5 Mo. Elle est basse parce que `client_max_body_size` vit hors
 * de ce dépôt et n'a pas encore été corrigé. Le jour où nginx acceptera des
 * corps plus gros, remonter cette constante ET `MEDIA_MAX_UPLOAD_BYTES` dans
 * docker-compose.yml, en conservant la même marge sous le plafond du proxy.
 */
const DEFAULT_MAX_UPLOAD_BYTES = 1_000_000;

/**
 * Configuration du stockage des médias, lue une seule fois au démarrage.
 *
 * Regroupée ici plutôt que dispersée en `process.env.X ?? défaut` au fil du
 * code : un plafond de taille qui vaudrait 8 Mio à un endroit et 5 Mio à un
 * autre laisserait passer des fichiers refusés ensuite, ou l'inverse.
 */
@Injectable()
export class MediaConfig {
  private readonly logger = new Logger(MediaConfig.name);

  /** Racine du volume où l'adaptateur système de fichiers écrit les octets. */
  readonly storagePath: string;

  /** Taille MAXIMALE des octets reçus, avant ré-encodage. */
  readonly maxUploadBytes: number;

  constructor(config: ConfigService) {
    this.storagePath = config.get<string>('MEDIA_STORAGE_PATH') ?? DEFAULT_STORAGE_PATH;
    this.maxUploadBytes = resolveMaxUploadBytes(
      config.get<string>('MEDIA_MAX_UPLOAD_BYTES'),
      this.logger,
    );
    this.warnIfMulterLimitDiverges();
  }

  /**
   * Le plafond de multer est lu dans `process.env` À L'IMPORT du contrôleur,
   * donc AVANT que `ConfigModule` n'ait chargé un éventuel fichier `.env`. Une
   * valeur définie uniquement dans ce fichier serait vue par `ConfigService`
   * mais pas par multer : le flux serait coupé à un seuil, refusé à un autre,
   * et la limite annoncée au front (celle de `MediaConfig`) ne serait pas celle
   * réellement appliquée.
   *
   * Le cas ne se produit pas en production — docker-compose passe la variable
   * dans l'environnement réel du processus. Il n'en est pas moins journalisé :
   * un plafond qui vaut deux choses à la fois est précisément le genre d'écart
   * qui ne se voit qu'au moment où un utilisateur se fait refuser une image
   * qu'on lui avait annoncée acceptable.
   */
  private warnIfMulterLimitDiverges(): void {
    const multerLimit = maxUploadBytesFromEnvironment();
    if (multerLimit === this.maxUploadBytes) return;

    this.logger.warn(
      `Plafond de téléversement INCOHÉRENT : multer coupe le flux à ${multerLimit} octets ` +
        `(lu dans process.env à l'import) alors que MediaConfig annonce ${this.maxUploadBytes} ` +
        'octets (lu via ConfigService). Définir MEDIA_MAX_UPLOAD_BYTES dans l’environnement du ' +
        'processus, pas seulement dans un fichier .env, pour que les deux coïncident.',
    );
  }
}

/**
 * Plafond de taille, en octets.
 *
 * Une valeur illisible (« 8Mo », « huit ») est REFUSÉE et remplacée par le
 * défaut, avec un log d'avertissement : la retenir telle quelle donnerait
 * `NaN`, et toute comparaison avec `NaN` étant fausse, le plafond serait
 * silencieusement désactivé — exactement le genre de panne muette que ce
 * projet proscrit.
 */
export function resolveMaxUploadBytes(rawValue: string | undefined, logger?: Logger): number {
  if (rawValue === undefined || rawValue.trim() === '') return DEFAULT_MAX_UPLOAD_BYTES;

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger?.warn(
      `MEDIA_MAX_UPLOAD_BYTES="${rawValue}" n'est pas un nombre d'octets exploitable ; ` +
        `application du défaut ${DEFAULT_MAX_UPLOAD_BYTES}. Une valeur non numérique ` +
        'désactiverait le plafond au lieu de le régler.',
    );
    return DEFAULT_MAX_UPLOAD_BYTES;
  }
  return Math.floor(parsed);
}

/**
 * Plafond lu directement dans `process.env`.
 *
 * Nécessaire au seul endroit où l'injection Nest n'est pas disponible : les
 * options de `FileInterceptor`, évaluées à la construction du décorateur. Le
 * service refait de toute façon le contrôle avec `MediaConfig`, qui reste la
 * référence ; multer sert ici à couper le flux tôt, pas à décider.
 */
export function maxUploadBytesFromEnvironment(): number {
  return resolveMaxUploadBytes(process.env.MEDIA_MAX_UPLOAD_BYTES);
}

export { DEFAULT_MAX_UPLOAD_BYTES, DEFAULT_STORAGE_PATH };
