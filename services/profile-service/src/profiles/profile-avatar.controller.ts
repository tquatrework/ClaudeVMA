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
  UseFilters,
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
import { MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES } from '../media/entities/media-settings.entity';
import { UploadSizeLimitFilter } from '../media/upload-size-limit.filter';
import { AvatarService, AvatarUploadResult } from './avatar.service';
import { AvatarConstraintsDto } from './dto/avatar-constraints.dto';

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

  /**
   * Déclarée AVANT les routes en `:userId/avatar`, bien qu'aucune ambiguïté
   * n'existe (le second segment est ici `constraints`, pas `avatar`). L'ordre
   * rend la lecture du fichier moins piégeuse : on voit tout de suite que ce
   * chemin ne prend pas d'identifiant.
   *
   * Pas de `:userId` : les contraintes ne dépendent ni du profil visé ni du
   * lecteur. Les paramétrer par utilisateur laisserait croire à une limite
   * personnalisable qui n'existe pas.
   */
  @Get('avatar/constraints')
  @ApiOperation({
    summary: 'Lire les contraintes d’envoi d’une photo de profil',
    description:
      'Publie la taille maximale et les formats acceptés, pour que le front les affiche AVANT ' +
      'que l’utilisateur ne choisisse un fichier et rejette localement un fichier trop lourd — ' +
      'plutôt que de le lui faire découvrir après plusieurs secondes d’envoi.\n\n' +
      'CES VALEURS NE DOIVENT PAS ÊTRE CODÉES EN DUR CÔTÉ FRONT. Elles proviennent de la même ' +
      'configuration que celle opposée à POST /profiles/:userId/avatar ; une copie côté client ' +
      'divergerait au premier ajustement et annoncerait alors une limite fausse.\n\n' +
      'La limite est basse aujourd’hui (1 Mo) : le reverse-proxy en amont plafonne les corps de ' +
      'requête à 1 Mio et renverrait un 413 HTML illisible avant même que le service ne soit ' +
      'appelé. Le plafond applicatif se tient sous celui du proxy pour que le refus soit ' +
      'toujours celui de l’application.\n\n' +
      'Route AUTHENTIFIÉE, mais indépendante du rôle : elle ne révèle aucune donnée personnelle.',
  })
  @ApiResponse({
    status: 200,
    type: AvatarConstraintsDto,
    description:
      'Contraintes en vigueur : `maxUploadBytes` (octets), `acceptedContentTypes`, ' +
      '`outputContentType`, `maxDimensionPixels`.',
  })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  getUploadConstraints(): Promise<AvatarConstraintsDto> {
    return this.avatarService.getUploadConstraints();
  }

  @Post(':userId/avatar')
  /**
   * 200, et non le 201 que Nest applique par défaut à un POST.
   *
   * Cette route ne crée pas une ressource nouvelle à une adresse nouvelle :
   * elle remplace le contenu d'une sous-ressource dont l'URL est fixe
   * (`/profiles/:userId/avatar`). Envoyer une deuxième photo n'ajoute rien, ça
   * substitue. Un 201 promettrait un `Location` vers une ressource créée, ce
   * qui n'existe pas ici.
   */
  @HttpCode(200)
  /**
   * Réécrit le `413` de multer, dont le corps se réduit sinon à
   * `{"message":"File too large"}` — sans la limite, sans la taille reçue,
   * donc inexploitable par le front autrement qu'en recopiant le plafond en
   * dur. Voir `upload-size-limit.filter.ts`.
   */
  @UseFilters(UploadSizeLimitFilter)
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
      /**
       * Le plafond est posé ICI, sur multer, et pas seulement dans le service.
       * La différence n'est pas cosmétique : multer compte les octets AU FIL DU
       * FLUX et coupe dès le dépassement. Un contrôle placé uniquement après
       * lecture complète aurait d'abord chargé tout le fichier en mémoire — soit
       * un moyen offert à n'importe quel appelant authentifié de faire enfler la
       * mémoire du service à volonté, en envoyant des corps arbitrairement gros.
       *
       * DEPUIS le 2026-08-26, CE PLAFOND EST STATIQUE À DESSEIN, et distinct de
       * celui réellement appliqué. `FileInterceptor` est construit UNE FOIS, à
       * l'import du contrôleur — avant toute requête, donc avant qu'un appel
       * asynchrone en base (le réglage réglable par le TI) ne soit possible.
       * `MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES` n'est donc PAS le plafond
       * annoncé au front ni celui qui produit le `413` normal : c'est un
       * FILET DE SÉCURITÉ fixe, égal à la borne haute autorisée pour le
       * réglage du TI (`UpdateMediaSettingsDto`) — il ne peut donc jamais
       * couper avant que la valeur RÉELLEMENT réglée ne le fasse.
       *
       * `AvatarService` refait le contrôle derrière, avec la valeur DYNAMIQUE :
       * voir le commentaire du second verrou dans `uploadAvatar`. C'est LUI qui
       * décide dans l'immense majorité des cas.
       */
      limits: {
        fileSize: MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES,
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
      'indiquant de réenregistrer la photo en JPEG.\n\n' +
      'TAILLE MAXIMALE : réglable À L’EXÉCUTION par le technicien informatique ' +
      '(PATCH /profiles/avatar/settings), 1 000 000 octets par défaut à l’amorçage ' +
      '(MEDIA_MAX_UPLOAD_BYTES). Volontairement basse par défaut — le reverse-proxy en amont ' +
      'plafonne les corps de requête à 1 Mio, et le plafond applicatif se tient juste en ' +
      'dessous pour que le refus vienne de l’application, avec un corps JSON exploitable, et ' +
      'non du proxy en HTML. La valeur en vigueur se lit sur ' +
      'GET /profiles/avatar/constraints : le front ne doit pas la coder en dur.',
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
      'Image plus lourde que le plafond en vigueur, réglable par le TI ' +
      '(1 000 000 octets par défaut à l’amorçage). Le plafond porte sur les octets REÇUS, ' +
      'avant ré-encodage. Dans l’immense majorité des cas, le flux est intégralement reçu puis ' +
      'refusé par le service (qui connaît la valeur réglée) ; seul un fichier dépassant le ' +
      'filet de sécurité fixe de multer est coupé en streaming avant la fin.\n\n' +
      'CORPS DE LA RÉPONSE, clés stables :\n' +
      '```json\n' +
      '{\n' +
      '  "statusCode": 413,\n' +
      '  "error": "Payload Too Large",\n' +
      '  "code": "UPLOAD_FILE_TOO_LARGE",\n' +
      '  "message": "Uploaded file exceeds the maximum allowed size",\n' +
      '  "maxUploadBytes": 1000000,\n' +
      '  "receivedBytes": null,\n' +
      '  "requestBodyBytes": 1258291\n' +
      '}\n' +
      '```\n' +
      'Le front teste `code`, JAMAIS `message` : celui-ci est en anglais technique, le libellé ' +
      'français est construit côté client à partir de `maxUploadBytes` (règle de langue du ' +
      '2026-08-09). `receivedBytes` vaut la taille exacte du fichier quand elle est connue, et ' +
      '`null` quand multer a coupé le flux avant la fin — auquel cas `requestBodyBytes` donne le ' +
      '`Content-Length` déclaré pour le corps entier, enveloppe multipart comprise. Ces deux ' +
      'champs peuvent être `null` ; `maxUploadBytes` est toujours présent.\n\n' +
      '⚠️ nginx en amont plafonne le corps de requête à 1 Mio et renvoie alors un 413 **HTML**, ' +
      'sans aucune de ces clés. Le plafond applicatif est réglé sous celui du proxy pour que ce ' +
      'cas ne se produise pas ; il reste possible si les deux réglages divergent. Le front doit ' +
      'donc tolérer un 413 dont le corps n’est pas du JSON.\n\n' +
      'La limite est lisible AVANT l’envoi : GET /profiles/avatar/constraints.',
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
