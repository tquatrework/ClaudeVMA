import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Port de stockage des octets des images du Mémo — volume Docker nommé
 * dédié (`pedagogical_log_memo_images`), distinct de `pedagogical_log_media`
 * (pièces jointes du cahier de texte) : deux fonctionnalités différentes,
 * même si elles appartiennent au même service — chaque chemin de stockage
 * reste séparé pour ne jamais mélanger deux cycles de vie (arbitrage du
 * 2026-08-26, point 4, appliqué ici par transposition).
 *
 * Nom de fichier stocké généré côté serveur (UUID), jamais dérivé du nom
 * client — même discipline que la photo de profil (2026-08-10) et les
 * pièces jointes du cahier de texte.
 */
@Injectable()
export class MemoImageStorageService {
  private readonly logger = new Logger(MemoImageStorageService.name);
  private readonly storagePath: string;

  constructor(private readonly config: ConfigService) {
    this.storagePath =
      this.config.get<string>('PEDAGOGICAL_LOG_MEMO_IMAGE_PATH') ??
      path.join(process.cwd(), 'storage', 'memo-images');
    try {
      fs.mkdirSync(this.storagePath, { recursive: true });
    } catch (error) {
      this.logger.error(
        `Impossible de créer le répertoire de stockage des images du mémo: ${(error as Error).message}`,
      );
    }
  }

  async save(buffer: Buffer): Promise<string> {
    const storedFilename = randomUUID();
    try {
      await fs.promises.writeFile(this.resolve(storedFilename), buffer);
    } catch (error) {
      this.logger.error(`Écriture de l'image du mémo impossible: ${(error as Error).message}`);
      throw new InternalServerErrorException("Stockage de l'image du mémo indisponible");
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
