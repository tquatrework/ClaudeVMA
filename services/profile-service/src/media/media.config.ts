import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Racine de stockage par défaut — volume nommé `media_data` (docker-compose.yml). */
const DEFAULT_STORAGE_PATH = '/app/storage/media';

/** 8 Mio : plafond d'entrée par défaut, aligné sur docker-compose.yml. */
const DEFAULT_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

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
