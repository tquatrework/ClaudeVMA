import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { NotebookService } from './notebook.service';
import { CreateNotebookEntryDto } from './dto/create-notebook-entry.dto';
import { FindNotebookQueryDto } from './dto/find-notebook-query.dto';

/**
 * Carnet personnel — espace privé réservé au titulaire authentifié.
 *
 * Généralisé le 2026-08-27 (docs/architecture.md, "Generalisation du carnet
 * personnel a d'autres roles que l'eleve") : ce n'est PAS un carnet "élève"
 * ouvert à d'autres rôles, c'est le MÊME mécanisme répliqué par titulaire.
 * N'IMPORTE QUEL utilisateur authentifié — élève, formateur, animateur
 * pédagogique, et tout rôle futur — a son propre carnet.
 *
 * Aucun `@Roles(...)` sur les routes `POST`/`GET`/`GET :id`/`DELETE`
 * ci-dessous : `RolesGuard` laisse passer tout rôle authentifié dès lors
 * qu'aucune liste de rôles n'est déclarée. Le seul contrôle d'accès qui
 * compte pour l'ÉCRITURE (`POST`, `DELETE`) et pour le détail (`GET :id`)
 * reste celui de `NotebookService` : titulaire uniquement, jamais personne
 * d'autre — y compris les rôles administratifs (RP, AF, TI), qui n'ont ici
 * AUCUNE exception. Ceci reste inchangé depuis le 2026-08-27.
 *
 * Changement observable par rapport à l'ancienne route :
 *   AVANT : students/:studentId/notebook          (réservé au rôle éleve, TI en plus)
 *   APRÈS : pedagogical-logs/notebook              (tout rôle, titulaire uniquement)
 * Le titulaire n'est plus un paramètre de chemin : il n'est jamais que
 * l'utilisateur authentifié (`req.user.id`), donc il n'existe plus d'URL
 * pouvant désigner le carnet d'un tiers — SAUF la route dédiée
 * `GET .../notebook/owners/:ownerId` ci-dessous (2026-08-28), seule
 * exception, en LECTURE SEULE, contrôlée par réglage TI.
 *
 * Préfixe `pedagogical-logs/` choisi délibérément (et non un nouveau préfixe
 * top-level `notebook/`) : `api-gateway` ne proxy que les préfixes connus
 * `/pedagogical-logs`, `/students`, `/logs` (bug réel documenté le
 * 2026-08-20, docs/routes.md — un préfixe non déclaré y est structurellement
 * injoignable depuis l'extérieur). Monter sous `/pedagogical-logs`, déjà
 * proxié, évite de reproduire cette même classe de bug et ne nécessite aucune
 * modification côté `api-gateway`.
 *
 * Spécification fonctionnelle réelle — notes rapides immuables (docs/
 * architecture.md, arbitrage du 2026-08-27) : une entrée n'est PAS une note
 * éditable, c'est une « pensée instantanée » horodatée automatiquement
 * (`createdAt`), retrouvée par recherche plutôt que par simple défilement.
 * Conséquence sur le contrat HTTP : `PATCH .../notebook/:id` (édition, livrée
 * par la généralisation du même jour) est RETIRÉE — une pensée instantanée ne
 * se corrige pas, elle se supprime (`DELETE`, conservé) et se réécrit si
 * besoin (`POST`, conservé). `GET .../notebook` accepte désormais des
 * paramètres de requête optionnels et combinables : `from`/`to` (plage de
 * dates sur `createdAt`, une date précise s'exprime avec `from=to`) et `q`
 * (recherche texte libre sur `content`) — voir `FindNotebookQueryDto`.
 *
 * Accès administratif et parental — arbitrage du 2026-08-28 (docs/
 * architecture.md, "Acces administratif et parental au carnet personnel —
 * parametrable par le TI, defaut ferme") : `GET .../notebook/owners/:ownerId`
 * ouvre, en LECTURE SEULE et seulement si le TI l'a activé (fermé par
 * défaut), le carnet d'un tiers à un rôle administratif (RP, puis AF/TI) ou
 * à un parent financeur activement rattaché. `@Roles(...)` y filtre déjà les
 * rôles STRUCTURELLEMENT jamais éligibles (élève, formateur, animateur
 * pédagogique) → `403` ; le réglage TI et la relation sont revérifiés à
 * chaque appel par `NotebookService.assertCanReadThirdParty` → `404` si non
 * couverts. Cette route ne segmente jamais avec `GET .../notebook/:id`
 * (nombre de segments différent, `owners/:ownerId` contre `:id` seul) — même
 * prudence d'ordre que `finance-owners` avant `:viewerId` chez
 * `profile-service` (docs/routes.md).
 */
@ApiTags('notebook')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pedagogical-logs/notebook')
export class NotebookController {
  constructor(private readonly service: NotebookService) {}

  @Post()
  @ApiOperation({
    summary: 'Add an entry to my own personal notebook',
    description:
      "Ajoute une entrée dans le carnet personnel de l'utilisateur authentifié. " +
      'Tout rôle authentifié peut écrire dans son propre carnet ; personne ne peut écrire dans celui d\'un tiers.',
  })
  @ApiResponse({ status: 201, description: 'Notebook entry created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateNotebookEntryDto, @Req() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List (or search) my own personal notebook entries',
    description:
      "Retourne les entrées du carnet personnel de l'utilisateur authentifié, " +
      "filtrées par les paramètres de requête optionnels s'ils sont fournis " +
      '(`from`/`to` sur `createdAt`, `q` en recherche texte libre sur `content`) ; ' +
      'sans filtre, retourne tout le carnet. ' +
      'Aucune exception, y compris pour les rôles administratifs : chacun ne voit que son propre carnet.',
  })
  @ApiResponse({ status: 200, description: 'Notebook entries list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query() query: FindNotebookQueryDto, @Req() req: any) {
    return this.service.findAll(req.user.id, query);
  }

  @Get('owners/:ownerId')
  @Roles(
    UserRole.PARENT_FINANCEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  )
  @ApiParam({ name: 'ownerId', description: 'UUID du titulaire du carnet' })
  @ApiOperation({
    summary: "Lire (ou rechercher) le carnet personnel d'un tiers",
    description:
      "Ouverte en LECTURE SEULE, uniquement si le réglage TI l'autorise (fermé par défaut). " +
      "RP (si adminAccess ∈ {rp, all_admins}) ou AF/TI (si adminAccess = all_admins) lisent le " +
      "carnet de n'importe quel titulaire. Un parent financeur lit le carnet du seul élève " +
      "auquel il est activement rattaché, si parentAccessToOwnChild est activé. Mêmes " +
      "paramètres de recherche (`from`/`to`/`q`) que GET /pedagogical-logs/notebook.",
  })
  @ApiResponse({ status: 200, description: 'Notebook entries list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: "Rôle structurellement jamais éligible à cette route (élève, formateur, animateur pédagogique)",
  })
  @ApiResponse({
    status: 404,
    description: "Réglage désactivé pour ce rôle, ou relation parent-élève absente/rompue (indiscernable d'un carnet vide)",
  })
  @ApiResponse({ status: 503, description: 'profile-service injoignable (vérification de la relation parent-élève)' })
  findAllForThirdParty(
    @Param('ownerId') ownerId: string,
    @Query() query: FindNotebookQueryDto,
    @Req() req: any,
  ) {
    return this.service.findAllForThirdParty(ownerId, req.user.id, req.user.role, query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Notebook entry UUID' })
  @ApiOperation({ summary: 'Get one of my own notebook entries by ID' })
  @ApiResponse({ status: 200, description: 'Notebook entry found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the owner of this entry' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Notebook entry UUID' })
  @ApiOperation({ summary: 'Delete one of my own notebook entries' })
  @ApiResponse({ status: 204, description: 'Notebook entry deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the owner of this entry' })
  @ApiResponse({ status: 404, description: 'Not found' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.id);
  }
}
