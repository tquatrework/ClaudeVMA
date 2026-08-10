import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { maxUploadBytesFromEnvironment } from '../media/media.config';
import { AvatarService, AvatarUploadResult } from './avatar.service';

/**
 * Durée de fraîcheur du cache navigateur, en secondes.
 *
 * Délibérément courte malgré le jeton `?v=` présent dans l'URL. Le jeton
 * règle le REMPLACEMENT d'une photo (URL différente ⇒ pas de collision de
 * cache) mais ne règle pas le MASQUAGE : un formateur qui aurait mis la photo
 * en cache continuerait de l'afficher après que l'élève l'a masquée. Une
 * minute borne cette fenêtre, et la revalidation par ETag rend le coût
 * habituel d'un rafraîchissement égal à un 304 vide.
 */
const AVATAR_CACHE_MAX_AGE_SECONDS = 60;

/**
 * Photo de profil — envoi, lecture des octets, suppression.
 *
 * Contrôleur séparé de `ProfilesController` : la ressource est distincte (des
 * octets, pas du JSON), elle a ses propres intercepteurs multipart et sa
 * propre négociation de contenu. La convention du service veut « un fichier,
 * un contrôleur, une racine de ressource cohérente ».
 *
 * Les règles de droit sont TOUTES dans `AvatarService` — ce contrôleur n'est
 * qu'un adaptateur HTTP.
 */
@ApiTags('profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('profiles')
export class ProfileAvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  @Post(':userId/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      /**
       * EN MÉMOIRE, jamais sur disque. Un stockage temporaire écrirait les
       * octets NON VÉRIFIÉS de l'appelant dans le système de fichiers avant
       * même de savoir s'il s'agit d'une image : c'est le contraire de ce que
       * fait ce lot. Ici rien ne touche le volume tant que le ré-encodage n'a
       * pas produit des octets propres.
       */
      storage: memoryStorage(),
      limits: {
        fileSize: maxUploadBytesFromEnvironment(),
        files: 1,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Formulaire multipart contenant l’image sous le champ `file`.',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Image JPEG, PNG, WebP, GIF ou AVIF' },
      },
    },
  })
  @ApiOperation({
    summary: 'Envoyer ou remplacer la photo de profil',
    description:
      'Téléverse la photo de profil du titulaire. Multipart, champ `file`, un seul fichier.\n\n' +
      'DROIT D’ÉCRITURE — LE TITULAIRE SEUL. Ni le parent financeur (qui lit tout mais n’écrit ' +
      'rien), ni le RP, le TI ou l’AF : la photo n’appartient au domaine d’aucun rôle ' +
      'administratif. Le TI qui doit neutraliser une photo passe par ' +
      'POST /admin/visibility-overrides, pas par un remplacement.\n\n' +
      'TRAITEMENT DES OCTETS — rien de ce qui est reçu n’est stocké tel quel :\n' +
      '  • le type est détecté sur les OCTETS RÉELS (nombres magiques). L’extension du nom de ' +
      'fichier et le `Content-Type` du client ne sont jamais consultés : ils sont sous le ' +
      'contrôle de l’appelant ;\n' +
      '  • l’image est INTÉGRALEMENT RÉ-ENCODÉE en WebP, bornée à 512 px de côté. Toute charge ' +
      'dissimulée dans le fichier d’origine disparaît, n’étant jamais recopiée ;\n' +
      '  • les MÉTADONNÉES EXIF sont supprimées, dont la géolocalisation — une photo de ' +
      'téléphone porte couramment les coordonnées du domicile. L’orientation EXIF est appliquée ' +
      'avant suppression, pour que les photos portrait ne ressortent pas couchées ;\n' +
      '  • le SVG est REFUSÉ : c’est un document XML pouvant contenir du code exécutable ;\n' +
      '  • le nom du fichier stocké est généré par le serveur (UUID) ; celui du client est ignoré.\n\n' +
      'REMPLACEMENT : le fichier précédent est supprimé du stockage, sinon les images ' +
      's’accumuleraient à chaque changement de photo.\n\n' +
      'Formats acceptés : JPEG, PNG, WebP, GIF, AVIF. HEIC/HEIF est refusé avec un message ' +
      'indiquant de réenregistrer la photo en JPEG.',
  })
  @ApiParam({ name: 'userId', description: 'UUID du titulaire du profil' })
  @ApiResponse({
    status: 200,
    description:
      'Photo enregistrée. Corps : `{ avatarUrl }` — URL de lecture VERSIONNÉE ' +
      '(`/api/v1/profiles/:userId/avatar?v=<horodatage>`), identique à celle que porte le bloc ' +
      '`administrative` de GET /profiles/:userId. Le jeton `?v=` change à chaque envoi, ce qui ' +
      'évite qu’une photo remplacée reste affichée depuis le cache du navigateur. ' +
      'Aucun chemin de fichier n’est jamais renvoyé.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Aucun fichier reçu, fichier qui n’est pas une image reconnue, SVG, HEIC/HEIF, ou image ' +
      'illisible/endommagée. Message explicite en français dans tous les cas.',
  })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({
    status: 403,
    description: 'Appelant autre que le titulaire du profil',
  })
  @ApiResponse({
    status: 413,
    description:
      'Image plus lourde que MEDIA_MAX_UPLOAD_BYTES (8 Mio par défaut). Le plafond porte sur les ' +
      'octets reçus, avant ré-encodage. Attention : nginx en amont applique son propre plafond de ' +
      'corps de requête, qui peut renvoyer 413 avant même d’atteindre le service.',
  })
  @ApiResponse({
    status: 500,
    description:
      'Profil administratif absent pour un compte existant (incohérence de données, jamais ' +
      'rattrapée par une création à la volée), ou stockage des médias indisponible.',
  })
  uploadAvatar(
    @Param('userId', ParseUUIDPipe) userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AvatarUploadResult> {
    return this.avatarService.uploadAvatar(userId, file, actor);
  }

  @Get(':userId/avatar')
  @ApiProduces('image/webp')
  @ApiOperation({
    summary: 'Lire les octets de la photo de profil',
    description:
      'Renvoie les OCTETS de l’image (aujourd’hui `image/webp`), pas une redirection ni une URL. ' +
      'Route AUTHENTIFIÉE : le jeton voyage dans l’en-tête `Authorization`, une balise ' +
      '`<img src>` ne peut donc pas l’atteindre directement — le client récupère les octets puis ' +
      'construit un object URL.\n\n' +
      'DROIT DE LECTURE — EXACTEMENT CELUI DU CHAMP `avatarUrl` de GET /profiles/:userId. La ' +
      'route emprunte les mêmes ports de contrôle d’accès et le même catalogue de visibilité ; ' +
      'elle ne refiltre rien de son côté, sans quoi elle en serait le contournement.\n\n' +
      'PHOTO MASQUÉE POUR CE LECTEUR ⇒ 404, PAS 403. C’est la cohérence avec le filtrage champ ' +
      'par champ, où « un champ masqué est ABSENT de la réponse » : un 403 révélerait ' +
      'l’existence de la photo, soit précisément ce que le titulaire a choisi de ne pas ' +
      'partager. Le message est le même que pour une absence de photo, et c’est voulu.\n\n' +
      'Le parent financeur et les rôles administratifs (RP, AP, TI, AF) sont exemptés du ' +
      'filtrage, comme partout ailleurs.',
  })
  @ApiParam({ name: 'userId', description: 'UUID du titulaire du profil' })
  @ApiResponse({
    status: 200,
    description:
      'Octets de l’image. En-têtes : `Content-Type` (image/webp), `Content-Length`, `ETag` et ' +
      '`Cache-Control: private, max-age=60, must-revalidate`. La fraîcheur est courte à dessein : ' +
      'le jeton `?v=` gère le remplacement, mais pas le passage d’une photo visible à masquée.',
  })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({
    status: 403,
    description:
      'Aucun droit de lecture sur ce PROFIL (formateur non rattaché, parent non rattaché, élève ' +
      'consultant autrui). Distinct du 404 : ici c’est l’accès au profil qui est refusé, pas la ' +
      'photo qui est masquée.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Aucune photo disponible pour ce lecteur — soit le profil n’en a pas, soit elle lui est ' +
      'masquée. Les deux cas sont volontairement indiscernables.',
  })
  async getAvatar(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const avatar = await this.avatarService.getAvatarBytes(userId, actor);

    response.set({
      'Content-Type': avatar.contentType,
      'Content-Length': String(avatar.bytes.length),
      // `private` : jamais mis en cache par un intermédiaire partagé. La photo
      // d'un élève n'a rien à faire dans le cache d'un proxy où un autre
      // lecteur pourrait la récupérer sans passer par le filtrage.
      'Cache-Control': `private, max-age=${AVATAR_CACHE_MAX_AGE_SECONDS}, must-revalidate`,
      ETag: `"${avatar.updatedAt.getTime()}-${avatar.bytes.length}"`,
      'Last-Modified': avatar.updatedAt.toUTCString(),
    });

    return new StreamableFile(avatar.bytes);
  }

  @Delete(':userId/avatar')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Supprimer la photo de profil',
    description:
      'Retire la photo de profil : la référence en base ET le fichier sur le stockage, pour que ' +
      'les images ne s’accumulent pas.\n\n' +
      'DROIT — LE TITULAIRE SEUL, mêmes règles que l’envoi.\n\n' +
      'IDEMPOTENT : supprimer une photo déjà absente répond `204` et non `404`. L’état visé — ' +
      '« ce profil n’a pas de photo » — est atteint ; un double clic sur « Supprimer » ne doit ' +
      'pas produire d’erreur. Ce n’est pas un champ accepté puis ignoré, mais la sémantique ' +
      'normale de DELETE.\n\n' +
      'Après suppression, `avatarUrl` vaut `null` dans le bloc `administrative` de ' +
      'GET /profiles/:userId.',
  })
  @ApiParam({ name: 'userId', description: 'UUID du titulaire du profil' })
  @ApiResponse({ status: 204, description: 'Photo supprimée, ou déjà absente (idempotent)' })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 403, description: 'Appelant autre que le titulaire du profil' })
  deleteAvatar(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.avatarService.deleteAvatar(userId, actor);
  }
}
