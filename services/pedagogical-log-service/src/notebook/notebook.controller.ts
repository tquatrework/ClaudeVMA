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
 * Aucun `@Roles(...)` sur ce contrôleur : `RolesGuard` laisse passer tout
 * rôle authentifié dès lors qu'aucune liste de rôles n'est déclarée. Le seul
 * contrôle d'accès qui compte est celui de `NotebookService` : titulaire
 * uniquement, jamais personne d'autre — y compris les rôles administratifs
 * (RP, AF, TI), qui n'ont ici AUCUNE exception, contrairement à leur accès
 * large habituel au reste des profils.
 *
 * Changement observable par rapport à l'ancienne route :
 *   AVANT : students/:studentId/notebook          (réservé au rôle éleve, TI en plus)
 *   APRÈS : pedagogical-logs/notebook              (tout rôle, titulaire uniquement)
 * Le titulaire n'est plus un paramètre de chemin : il n'est jamais que
 * l'utilisateur authentifié (`req.user.id`), donc il n'existe plus d'URL
 * pouvant désigner le carnet d'un tiers.
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
