import { Body, Controller, HttpCode, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { MediaSettingsView, toMediaSettingsView } from './dto/media-settings.view';
import { UpdateMediaSettingsDto } from './dto/update-media-settings.dto';
import { MediaSettingsService } from './media-settings.service';

/**
 * Réglages système du plafond d'envoi de la photo de profil (arbitrage du
 * 2026-08-26, point 8 de « Liens et pièces jointes sur une entrée de cahier
 * de texte, et paramètres système associés » — docs/architecture.md).
 *
 * SOUS `/profiles`, PAS SOUS `/admin`. `PATCH /admin/media-settings` était la
 * forme proposée dans le brief, mais `location ^~ /api/v1/admin` de
 * `gateway/api-gateway/nginx.conf` route déjà TOUT ce préfixe vers
 * `admin-observability-service` — y ajouter une route sous ce même chemin
 * dans profile-service l'aurait rendue injoignable sans modifier la gateway,
 * hors périmètre de ce chantier. `/profiles/avatar/settings` reste sous le
 * préfixe déjà routé vers ce service (`^~ /api/v1/profiles`), symétrique de
 * `GET /profiles/avatar/constraints`.
 *
 * ÉCRITURE RÉSERVÉE AU TI. La LECTURE de la valeur en vigueur reste publique-
 * authentifiée via `GET /profiles/avatar/constraints` (`maxUploadBytes`),
 * inchangée dans son contrat — inutile de dupliquer un `GET` ici : le TI qui
 * ouvre l'écran « Paramètres système » peut préremplir le formulaire avec la
 * même route que celle déjà lue par le formulaire d'envoi de photo.
 */
@ApiTags('profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('profiles/avatar')
export class MediaSettingsController {
  constructor(private readonly mediaSettingsService: MediaSettingsService) {}

  @Patch('settings')
  @Roles(UserRole.TECHNICIEN_INFORMATIQUE)
  /**
   * 200, pas 201 : remplace la valeur d'une ressource à adresse fixe (le
   * réglage singleton), n'en crée pas une nouvelle — même raisonnement que
   * `POST /profiles/:userId/avatar` dans `ProfileAvatarController`.
   */
  @HttpCode(200)
  @ApiOperation({
    summary: 'Régler le plafond d’envoi de la photo de profil',
    description:
      'Remplace le plafond de taille appliqué par POST /profiles/:userId/avatar, À ' +
      'L’EXÉCUTION, sans redéploiement. Réservé au technicien informatique.\n\n' +
      'Avant ce chantier, ce plafond était figé par la variable d’environnement ' +
      'MEDIA_MAX_UPLOAD_BYTES, relue uniquement au démarrage du service. Elle reste la valeur ' +
      'd’AMORÇAGE (posée au tout premier appel si aucun réglage n’existe encore en base), ' +
      'mais n’est plus la valeur appliquée une fois ce premier appel passé.\n\n' +
      '⚠️ Ce réglage reste, en pratique, plafonné par les couches réseau en amont : ' +
      '`nginx-global` (1 Mio, non déclaré, hors dépôt) puis `api-gateway` (10 Mio, déclaré). ' +
      'Régler une valeur au-delà du plafond de `nginx-global` produit le même `413` HTML ' +
      'illisible déjà documenté pour l’envoi de la photo — voir docs/routes.md, section ' +
      '« Photo de profil ». Cette route ne l’empêche pas : la décision reste celle du TI.',
  })
  @ApiResponse({
    status: 200,
    type: MediaSettingsView,
    description: 'Réglage mis à jour, valeur relue depuis la base.',
  })
  @ApiResponse({
    status: 400,
    description:
      'maxAvatarUploadBytes absent, non entier, ou hors bornes ' +
      '(voir UpdateMediaSettingsDto pour les valeurs exactes).',
  })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({
    status: 403,
    description: 'Rôle non autorisé — technicien informatique seulement',
  })
  async updateSettings(
    @Body() dto: UpdateMediaSettingsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<MediaSettingsView> {
    const settings = await this.mediaSettingsService.updateMaxAvatarUploadBytes(
      dto.maxAvatarUploadBytes,
      actor,
    );
    return toMediaSettingsView(settings);
  }
}
