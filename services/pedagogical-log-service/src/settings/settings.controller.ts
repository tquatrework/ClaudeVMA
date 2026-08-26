import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { PedagogicalLogSettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/**
 * Réglages système des pièces jointes du cahier de texte.
 *
 * Montée sous le préfixe `/pedagogical-logs`, déjà proxié par api-gateway
 * (voir docs/routes.md, section pedagogical-log-service) — aucun nouveau
 * préfixe gateway n'est nécessaire.
 *
 * Lecture ouverte à tout compte authentifié (le formateur doit pouvoir lire
 * le plafond courant avant d'afficher le bouton "Joindre un fichier", même
 * discipline que GET /profiles/avatar/constraints). Écriture réservée au TI
 * (arbitrage du 2026-08-26, point 9).
 */
@ApiTags('pedagogical-log-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pedagogical-logs/settings')
export class SettingsController {
  constructor(private readonly service: PedagogicalLogSettingsService) {}

  @Get('attachments')
  @Roles(
    UserRole.ELEVE,
    UserRole.PARENT_FINANCEUR,
    UserRole.FORMATEUR,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  )
  @ApiOperation({
    summary: 'Lire les réglages courants des pièces jointes',
    description:
      'À lire avant d\'afficher le bouton "Joindre un fichier" (état activé/désactivé, ' +
      'plafonds courants). Ouvert à tout compte authentifié.',
  })
  @ApiResponse({ status: 200, description: 'Réglages courants' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  getAttachmentSettings() {
    return this.service.getSettings();
  }

  @Patch('attachments')
  @Roles(UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'Modifier les réglages des pièces jointes (TI uniquement)',
    description: 'Mise à jour partielle — seuls les champs fournis sont modifiés.',
  })
  @ApiResponse({ status: 200, description: 'Réglages modifiés' })
  @ApiResponse({ status: 400, description: 'Plafond par fichier supérieur au plafond total, ou validation' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé au technicien informatique' })
  updateAttachmentSettings(@Body() dto: UpdateSettingsDto) {
    return this.service.updateSettings(dto);
  }
}
