import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { PedagogicalLogSettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { NotebookAccessSettingsService } from './notebook-access-settings.service';
import { UpdateNotebookAccessSettingsDto } from './dto/update-notebook-access-settings.dto';

/**
 * Réglages système du cahier de texte (pièces jointes) et du carnet personnel
 * (accès administratif/parental en lecture seule).
 *
 * Montée sous le préfixe `/pedagogical-logs`, déjà proxié par api-gateway
 * (voir docs/routes.md, section pedagogical-log-service) — aucun nouveau
 * préfixe gateway n'est nécessaire.
 *
 * Lecture ouverte à tout compte authentifié (le front doit pouvoir lire
 * l'état courant avant d'afficher un point d'entrée de consultation, même
 * discipline que GET /profiles/avatar/constraints). Écriture réservée au TI
 * (arbitrage du 2026-08-26, point 9, repris le 2026-08-28 pour le carnet
 * personnel).
 */
@ApiTags('pedagogical-log-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pedagogical-logs/settings')
export class SettingsController {
  constructor(
    private readonly service: PedagogicalLogSettingsService,
    private readonly notebookAccessSettingsService: NotebookAccessSettingsService,
  ) {}

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

  // ─────────────────────────────────────────────────────────────────────
  // Accès administratif et parental au carnet personnel — arbitrage du
  // 2026-08-28 (docs/architecture.md, "Acces administratif et parental au
  // carnet personnel — parametrable par le TI, defaut ferme"). Réglages
  // distincts de ceux des pièces jointes ci-dessus (domaine séparé, table
  // singleton séparée) — n'ouvrent JAMAIS l'écriture sur un carnet tiers.
  // ─────────────────────────────────────────────────────────────────────

  @Get('notebook-access')
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
    summary: "Lire les réglages courants d'accès au carnet personnel d'un tiers",
    description:
      "À lire avant d'afficher une éventuelle section « carnet personnel » sur la fiche " +
      "d'un tiers (RP/AF/TI) ou sur la vue de l'élève (parent) — la section ne doit jamais " +
      'être affichée pour être découverte vide ou en erreur. Ouvert à tout compte authentifié.',
  })
  @ApiResponse({ status: 200, description: 'Réglages courants' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  getNotebookAccessSettings() {
    return this.notebookAccessSettingsService.getSettings();
  }

  @Patch('notebook-access')
  @Roles(UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: "Modifier les réglages d'accès au carnet personnel (TI uniquement)",
    description:
      'Mise à jour partielle — seuls les champs fournis sont modifiés. Ne modifie jamais un ' +
      'droit déjà accordé sur un carnet précis : le contrôle est refait à chaque lecture.',
  })
  @ApiResponse({ status: 200, description: 'Réglages modifiés' })
  @ApiResponse({ status: 400, description: 'Validation (valeur hors énumération pour adminAccess)' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé au technicien informatique' })
  updateNotebookAccessSettings(@Body() dto: UpdateNotebookAccessSettingsDto) {
    return this.notebookAccessSettingsService.updateSettings(dto);
  }
}
