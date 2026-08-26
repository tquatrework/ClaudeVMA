import { ArgumentsHost, PayloadTooLargeException } from '@nestjs/common';
import { MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES } from '../../../src/media/entities/media-settings.entity';
import {
  buildUploadFileTooLargeBody,
  isUploadFileTooLargeBody,
  UPLOAD_FILE_TOO_LARGE_CODE,
  uploadFileTooLargeException,
} from '../../../src/media/upload-size-limit';
import { UploadSizeLimitFilter } from '../../../src/media/upload-size-limit.filter';

/**
 * Message exact produit par multer via @nestjs/platform-express lorsque
 * `limits.fileSize` est atteint. Recopié ici volontairement : si une montée de
 * version le change, ce test n'échouera pas — mais le filtre, lui, continue de
 * fonctionner puisqu'il intercepte le TYPE d'exception, pas son texte.
 */
const MULTER_LIMIT_MESSAGE = 'File too large';

const makeHost = (headers: Record<string, string> = {}) => {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ headers }),
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
};

describe('Contrat d’erreur du dépassement de taille', () => {
  describe('corps de la réponse', () => {
    it('porte les clés stables attendues par le front', () => {
      const body = buildUploadFileTooLargeBody({
        maxUploadBytes: 1_000_000,
        receivedBytes: 2_400_000,
        requestBodyBytes: 2_400_512,
      });

      expect(body).toEqual({
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'UPLOAD_FILE_TOO_LARGE',
        message: 'Uploaded file exceeds the maximum allowed size',
        maxUploadBytes: 1_000_000,
        receivedBytes: 2_400_000,
        requestBodyBytes: 2_400_512,
      });
    });

    /**
     * Règle de langue du 2026-08-09 : les clés d'API sont en anglais et le
     * libellé lu par l'utilisateur est porté côté front. Un message français
     * figé ici imposerait sa formulation à tous les écrans.
     */
    it('garde un message en anglais technique, la phrase française restant au front', () => {
      const { message } = buildUploadFileTooLargeBody({ maxUploadBytes: 1_000_000 });

      expect(message).toBe('Uploaded file exceeds the maximum allowed size');
      expect(message).not.toMatch(/[éèêàùç]/i);
    });

    it('met les tailles inconnues à null plutôt que de les omettre', () => {
      const body = buildUploadFileTooLargeBody({ maxUploadBytes: 1_000_000 });

      expect(body.receivedBytes).toBeNull();
      expect(body.requestBodyBytes).toBeNull();
      expect(Object.keys(body)).toContain('receivedBytes');
      expect(Object.keys(body)).toContain('requestBodyBytes');
    });

    it('produit une PayloadTooLargeException dont le corps EST ce contrat', () => {
      const exception = uploadFileTooLargeException({
        maxUploadBytes: 1_000_000,
        receivedBytes: 1_048_577,
      });

      expect(exception).toBeInstanceOf(PayloadTooLargeException);
      expect(exception.getStatus()).toBe(413);
      expect(exception.getResponse()).toMatchObject({
        code: UPLOAD_FILE_TOO_LARGE_CODE,
        maxUploadBytes: 1_000_000,
        receivedBytes: 1_048_577,
      });
    });

    it('reconnaît un corps déjà structuré, et lui seul', () => {
      expect(isUploadFileTooLargeBody(buildUploadFileTooLargeBody({ maxUploadBytes: 1 }))).toBe(
        true,
      );
      expect(isUploadFileTooLargeBody({ statusCode: 413, message: MULTER_LIMIT_MESSAGE })).toBe(
        false,
      );
      expect(isUploadFileTooLargeBody(MULTER_LIMIT_MESSAGE)).toBe(false);
      expect(isUploadFileTooLargeBody(null)).toBe(false);
    });
  });

  describe('UploadSizeLimitFilter', () => {
    const filter = new UploadSizeLimitFilter();

    /**
     * Sans ce filtre, le corps se réduit à `{"message":"File too large"}` : le
     * front ne peut ni dire de combien le fichier dépasse, ni afficher la
     * limite sans la recopier en dur.
     *
     * Depuis le 2026-08-26, ce chemin ne se déclenche QUE si multer a
     * lui-même coupé le flux — c'est-à-dire un fichier dépassant
     * `MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES`, le filet de sécurité STATIQUE
     * (voir `ProfileAvatarController`). Ce n'est plus une variable
     * d'environnement : la limite annoncée ici est donc la CONSTANTE, pas une
     * valeur lue dans `process.env`.
     */
    it('remplace le 413 nu de multer par le corps structuré', () => {
      const { host, response } = makeHost({ 'content-length': '2400512' });

      filter.catch(new PayloadTooLargeException(MULTER_LIMIT_MESSAGE), host);

      expect(response.status).toHaveBeenCalledWith(413);
      expect(response.json).toHaveBeenCalledWith({
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'UPLOAD_FILE_TOO_LARGE',
        message: 'Uploaded file exceeds the maximum allowed size',
        maxUploadBytes: MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES,
        // Le flux a été coupé : la taille du fichier n'a jamais été connue.
        receivedBytes: null,
        requestBodyBytes: 2_400_512,
      });
    });

    it('annonce toujours le même filet de sécurité, quel que soit l’environnement', () => {
      const { host, response } = makeHost();

      filter.catch(new PayloadTooLargeException(MULTER_LIMIT_MESSAGE), host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ maxUploadBytes: MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES }),
      );
    });

    it('met requestBodyBytes à null si le client n’a pas déclaré de Content-Length', () => {
      const { host, response } = makeHost();

      filter.catch(new PayloadTooLargeException(MULTER_LIMIT_MESSAGE), host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ requestBodyBytes: null }),
      );
    });

    it('ignore un Content-Length illisible plutôt que de renvoyer NaN', () => {
      const { host, response } = makeHost({ 'content-length': 'beaucoup' });

      filter.catch(new PayloadTooLargeException(MULTER_LIMIT_MESSAGE), host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ requestBodyBytes: null }),
      );
    });

    /**
     * Le refus venu du service porte la taille EXACTE du fichier ; le filtre
     * serait incapable de la retrouver, il ne doit donc pas l'écraser.
     */
    it('laisse intact un corps déjà structuré par le service', () => {
      const { host, response } = makeHost({ 'content-length': '2400512' });
      const fromService = uploadFileTooLargeException({
        maxUploadBytes: 1_000_000,
        receivedBytes: 1_337_000,
      });

      filter.catch(fromService, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ receivedBytes: 1_337_000, requestBodyBytes: null }),
      );
    });
  });
});
