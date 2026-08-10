import { InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { FilesystemMediaStorageAdapter } from '../../../src/media/filesystem-media-storage.adapter';
import { MediaConfig } from '../../../src/media/media.config';

/**
 * Adaptateur système de fichiers du port de stockage.
 *
 * Deux propriétés sont vérifiées ici, et elles sont indissociables :
 *  - il stocke et relit fidèlement les octets ;
 *  - il ne laisse JAMAIS filtrer un chemin, ni dans une valeur de retour, ni
 *    dans un message d'erreur. C'est cette discipline qui rendra le passage à
 *    un stockage objet possible sans toucher un appelant.
 */
describe('FilesystemMediaStorageAdapter', () => {
  let rootPath: string;
  let adapter: FilesystemMediaStorageAdapter;

  const makeKey = (extension = 'webp') => `avatars/${randomUUID()}.${extension}`;

  beforeEach(async () => {
    rootPath = join(tmpdir(), `profile-media-${randomUUID()}`);
    await fs.mkdir(rootPath, { recursive: true });
    adapter = new FilesystemMediaStorageAdapter({
      storagePath: rootPath,
      maxUploadBytes: 1024,
    } as MediaConfig);
  });

  afterEach(async () => {
    await fs.rm(rootPath, { recursive: true, force: true });
  });

  describe('cycle nominal', () => {
    it('écrit puis relit les octets à l’identique', async () => {
      const objectKey = makeKey();
      const bytes = Buffer.from([1, 2, 3, 250, 251, 252]);

      await adapter.save(objectKey, bytes);

      expect(await adapter.read(objectKey)).toEqual(bytes);
    });

    it('crée l’arborescence manquante sous la racine', async () => {
      const objectKey = makeKey();

      await adapter.save(objectKey, Buffer.from('x'));

      await expect(fs.stat(join(rootPath, 'avatars'))).resolves.toBeDefined();
    });

    it('écrase la version précédente pour une même clé', async () => {
      const objectKey = makeKey();
      await adapter.save(objectKey, Buffer.from('ancienne'));
      await adapter.save(objectKey, Buffer.from('nouvelle'));

      expect((await adapter.read(objectKey))?.toString()).toBe('nouvelle');
    });

    it('ne laisse derrière lui aucun fichier temporaire', async () => {
      const objectKey = makeKey();
      await adapter.save(objectKey, Buffer.from('contenu'));

      const written = await fs.readdir(join(rootPath, 'avatars'));

      expect(written).toHaveLength(1);
      expect(written.some((name) => name.endsWith('.part'))).toBe(false);
    });
  });

  describe('absence', () => {
    it('renvoie null — et non une erreur — pour une clé inexistante', async () => {
      expect(await adapter.read(makeKey())).toBeNull();
    });

    it('supprime sans broncher une clé déjà absente (idempotence)', async () => {
      await expect(adapter.delete(makeKey())).resolves.toBeUndefined();
    });

    it('supprime effectivement le fichier', async () => {
      const objectKey = makeKey();
      await adapter.save(objectKey, Buffer.from('à effacer'));

      await adapter.delete(objectKey);

      expect(await adapter.read(objectKey)).toBeNull();
      expect(await fs.readdir(join(rootPath, 'avatars'))).toHaveLength(0);
    });
  });

  describe('traversée de répertoire', () => {
    const hostileKeys = [
      '../../etc/passwd',
      'avatars/../../../etc/passwd',
      '/etc/passwd',
      'avatars/..%2f..%2fpasswd.webp',
      'avatars\\..\\..\\windows.webp',
      'AVATARS/00000000-0000-0000-0000-000000000000.webp',
      'avatars/not-a-uuid.webp',
      'avatars/00000000-0000-0000-0000-000000000000.exe.webp',
    ];

    it.each(hostileKeys)('refuse la clé hostile « %s »', async (hostileKey) => {
      await expect(adapter.read(hostileKey)).rejects.toThrow(InternalServerErrorException);
      await expect(adapter.save(hostileKey, Buffer.from('x'))).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.delete(hostileKey)).rejects.toThrow(InternalServerErrorException);
    });

    it('n’écrit rien hors de la racine quand la clé est hostile', async () => {
      await expect(adapter.save('../evade.webp', Buffer.from('x'))).rejects.toThrow();

      await expect(fs.stat(join(rootPath, '..', 'evade.webp'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    });
  });

  describe('aucune fuite de chemin', () => {
    it('ne met aucun chemin dans le message d’une clé invalide', async () => {
      await expect(adapter.read('../../etc/passwd')).rejects.toThrow('Clé de média invalide');
    });

    it('ne met aucun chemin dans le message d’une panne de lecture', async () => {
      const objectKey = makeKey();
      // Un DOSSIER là où un fichier est attendu : `readFile` échoue avec EISDIR,
      // et non ENOENT. C'est le chemin d'erreur « vraie panne ».
      await fs.mkdir(join(rootPath, objectKey), { recursive: true });

      const failure = await adapter.read(objectKey).catch((error: Error) => error);

      expect(failure).toBeInstanceOf(InternalServerErrorException);
      expect((failure as Error).message).not.toContain(rootPath);
      expect((failure as Error).message).not.toContain(objectKey);
      expect((failure as Error).message).not.toContain('/');
    });
  });
});
