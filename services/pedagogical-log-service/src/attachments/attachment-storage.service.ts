import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Port de stockage des octets de pièces jointes — volume Docker nommé dédié
 * à ce service (`pedagogical_log_media`), jamais le volume `media_data` de
 * profile-service (arbitrage du 2026-08-26, point 4 : "chaque service reste
 * propriétaire de ses propres binaires").
 *
 * Le nom de fichier stocké est un UUID généré côté serveur, jamais dérivé du
 * nom client — même discipline que la photo de profil (2026-08-10).
 */
@Injectable()
export class AttachmentStorageService {
  private readonly logger = new Logger(AttachmentStorageService.name);
  private readonly storagePath: string;

  constructor(private readonly config: ConfigService) {
    this.storagePath =
      this.config.get<string>('PEDAGOGICAL_LOG_MEDIA_PATH') ??
      path.join(process.cwd(), 'storage', 'media');
    try {
      fs.mkdirSync(this.storagePath, { recursive: true });
    } catch (error) {
      this.logger.error(
        `Impossible de créer le répertoire de stockage des pièces jointes: ${(error as Error).message}`,
      );
    }
  }

  async save(buffer: Buffer): Promise<string> {
    const storedFilename = randomUUID();
    try {
      await fs.promises.writeFile(this.resolve(storedFilename), buffer);
    } catch (error) {
      this.logger.error(`Écriture de la pièce jointe impossible: ${(error as Error).message}`);
      throw new InternalServerErrorException("Stockage de la pièce jointe indisponible");
    }
    return storedFilename;
  }

  async read(storedFilename: string): Promise<Buffer> {
    return fs.promises.readFile(this.resolve(storedFilename));
  }

  async delete(storedFilename: string): Promise<void> {
    await fs.promises.rm(this.resolve(storedFilename), { force: true });
  }

  private resolve(storedFilename: string): string {
    return path.join(this.storagePath, storedFilename);
  }
}
