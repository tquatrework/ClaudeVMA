import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RelationsService } from './relations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateFinanceOwnerStudentLinkDto } from './dto/create-finance-owner-student-link.dto';
import { CreateTeacherStudentLinkDto } from './dto/create-teacher-student-link.dto';
import { CreatePedagogicalCoordinatorLinkDto } from './dto/create-pedagogical-coordinator-link.dto';
import { CreateAnimatorTeacherLinkDto } from './dto/create-animator-teacher-link.dto';
import { OwnerAccess } from '../common/decorators/owner-access.decorator';
import { RELATION_KINDS } from './relation-kind';

@ApiTags('relations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('relations')
export class RelationsController {
  constructor(private readonly relationsService: RelationsService) {}

  /**
   * Déclaré AVANT les routes paramétrées : `my-contacts` est un segment
   * littéral, aucune d'elles ne le capterait (elles sont toutes préfixées par un
   * segment littéral distinct), mais l'ordre de lecture reste plus clair.
   */
  @Get('my-contacts')
  @OwnerAccess()
  @ApiOperation({
    summary: 'Lister les personnes auxquelles je suis relié',
    description:
      "Renvoie les personnes reliées à l'utilisateur AUTHENTIFIÉ — jamais celles d'un tiers : " +
      "il n'y a pas de paramètre d'identifiant, donc rien à falsifier.\n\n" +
      'Chaque entrée porte le PRÉNOM et le NOM de la personne, et la nature du lien. ' +
      "Elle sert à construire un sélecteur « qui consulter ? » (écran /archives, écran " +
      '« mes élèves ») sans afficher un seul UUID : `userId` n\'est là que pour construire ' +
      "l'appel suivant (`GET /profiles/:userId/statistics`, archives), jamais pour l'affichage " +
      '(arbitrage du 2026-08-09).\n\n' +
      `Valeurs possibles de \`relations[].kind\` : ${RELATION_KINDS.join(', ')}.\n\n` +
      'Les liens INDIRECTS sont inclus : un parent financeur voit les formateurs de ses élèves ' +
      "(`finance_owner_of_student_of_teacher`, avec l'élève commun dans `throughUserIds`), un " +
      'formateur voit les parents financeurs de ses élèves. Aucune table ne porte ces liens : ' +
      "ils sont dérivés de l'élève commun.\n\n" +
      "Ouverte à TOUT compte authentifié, sans liste de rôles : une liste oublie un rôle à " +
      "chaque évolution, et il n'y a rien à protéger — on ne renvoie que les relations du " +
      'demandeur lui-même. Un compte sans aucun lien reçoit `200 []`, jamais une erreur.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Liste triée par nom : `[{userId, firstName, lastName, relations: [{kind, isPrincipalTeacher?, throughUserIds?}]}]`. ' +
      "`firstName`/`lastName` valent `null` si la personne n'a pas de profil administratif.",
  })
  @ApiResponse({ status: 401, description: 'Sans jeton' })
  listMyRelatedPeople(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<RelationsService['listRelatedPeople']>>> {
    return this.relationsService.listRelatedPeople(actor.id);
  }

  @Post('finance-owner-student')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ADMINISTRATEUR_FINANCIER)
  @ApiOperation({
    summary: 'Link financeur to student',
    description:
      'Creates a financeur→élève relation. ' +
      'Allowed for RP and AdministrateurFinancier. ' +
      'Publishes StudentLinkedToFinanceOwner event.',
  })
  @ApiResponse({ status: 201, description: 'Link created' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP or AdministrateurFinancier only' })
  @ApiResponse({ status: 409, description: 'Link already exists' })
  linkFinanceOwnerToStudent(
    @Body() dto: CreateFinanceOwnerStudentLinkDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<RelationsService['linkFinanceOwnerToStudent']>>> {
    return this.relationsService.linkFinanceOwnerToStudent(dto, actor);
  }

  @Get('finance-owner-student/by-student/:studentId')
  @ApiOperation({
    summary: 'List financeurs of a student',
    description:
      'Returns all financeurs (parents) linked to the given student. ' +
      'Accessible to the student themselves, RP, AdministrateurFinancier and TI. ' +
      'Each item includes financeOwnerName ({firstName, lastName} or null) ' +
      "resolved from the financeur's administrative profile.",
  })
  @ApiParam({ name: 'studentId', description: 'Student (élève) UUID' })
  @ApiResponse({ status: 200, description: 'List of financeur–student links, enriched with financeOwnerName' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient rights' })
  getFinanceOwnersByStudent(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<RelationsService['getFinanceOwnersByStudent']>>> {
    return this.relationsService.getFinanceOwnersByStudent(studentId, actor);
  }

  @Get('finance-owner-student/:financeOwnerId')
  @ApiOperation({
    summary: 'List students of a financeur',
    description:
      'Returns all élève linked to the given financeur. ' +
      'Accessible to RP, AdministrateurFinancier, TI and the financeur themselves. ' +
      "Each item includes studentName ({firstName, lastName} or null) resolved from the student's administrative profile.",
  })
  @ApiParam({ name: 'financeOwnerId', description: 'Financeur UUID' })
  @ApiResponse({ status: 200, description: 'List of financeur–student links, enriched with studentName' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient rights' })
  getStudentsByFinanceOwner(
    @Param('financeOwnerId', ParseUUIDPipe) financeOwnerId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<RelationsService['getStudentsByFinanceOwner']>>> {
    return this.relationsService.getStudentsByFinanceOwner(financeOwnerId, actor);
  }

  @Post('teacher-student')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Link teacher to student',
    description:
      'Creates a formateur→élève relation (PROF-BR-007). ' +
      'Optionally marks the teacher as the principal teacher. ' +
      'Restricted to RP only. ' +
      'Publishes TeacherLinkedToStudent event.',
  })
  @ApiResponse({ status: 201, description: 'Link created' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP only' })
  @ApiResponse({ status: 409, description: 'Link already exists' })
  linkTeacherToStudent(
    @Body() dto: CreateTeacherStudentLinkDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<RelationsService['linkTeacherToStudent']>>> {
    return this.relationsService.linkTeacherToStudent(dto, actor);
  }

  @Get('teacher-student/:studentId')
  @ApiOperation({
    summary: 'List teachers of a student',
    description:
      'Returns all formateurs linked to the given student. ' +
      'Accessible to RP, TI, AdministrateurFinancier, the student themselves, ' +
      'any PARENT_FINANCEUR linked to that student, ' +
      'and their linked teachers (own link only, PROF-FB-003).',
  })
  @ApiParam({ name: 'studentId', description: 'Student (élève) UUID' })
  @ApiResponse({ status: 200, description: 'List of teacher–student links' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient rights' })
  getTeachersByStudent(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<RelationsService['getTeachersByStudent']>>> {
    return this.relationsService.getTeachersByStudent(studentId, actor);
  }

  @Post('pedagogical-coordinator')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Assign a pedagogical coordinator to a student',
    description:
      'Links a RP or AP as the pedagogical coordinator for a student. ' +
      'Restricted to RP only.',
  })
  @ApiResponse({ status: 201, description: 'Coordinator link created' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP only' })
  @ApiResponse({ status: 409, description: 'Link already exists' })
  linkPedagogicalCoordinator(
    @Body() dto: CreatePedagogicalCoordinatorLinkDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<RelationsService['linkPedagogicalCoordinator']>>> {
    return this.relationsService.linkPedagogicalCoordinator(dto, actor);
  }

  @Get('pedagogical-coordinator/:coordinatorId')
  @ApiOperation({
    summary: 'List students of a coordinator',
    description:
      'Returns all students assigned to the given RP or AP coordinator. ' +
      'Accessible to RP, TI and the coordinator themselves.',
  })
  @ApiParam({ name: 'coordinatorId', description: 'Coordinator (RP or AP) UUID' })
  @ApiResponse({ status: 200, description: 'List of coordinator–student links' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient rights' })
  getStudentsByCoordinator(
    @Param('coordinatorId', ParseUUIDPipe) coordinatorId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<RelationsService['getStudentsByCoordinator']>>> {
    return this.relationsService.getStudentsByCoordinator(coordinatorId, actor);
  }

  @Post('animator-teacher')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Rattacher un animateur pédagogique à un formateur',
    description:
      "Crée la relation AP → formateur. C'est elle, et elle seule, qui ouvre à l'AP la lecture " +
      'des statistiques et des archives pédagogiques du formateur (arbitrage du 2026-08-11). ' +
      "Aucune table ne la portait jusqu'ici : `pedagogical-coordinator` lie un coordinateur à un " +
      'ÉLÈVE, pas à un formateur.\n\n' +
      "Réservé au RP : c'est lui qui promeut un formateur en AP, c'est donc lui qui décide de ce " +
      "qu'un AP anime — un AP ne se donne pas ses propres animés.",
  })
  @ApiResponse({ status: 201, description: 'Lien créé : `{id, animatorId, teacherId, createdAt}`' })
  @ApiResponse({ status: 400, description: 'animatorId ou teacherId absent ou non-UUID' })
  @ApiResponse({ status: 403, description: 'Interdit — RP uniquement' })
  @ApiResponse({ status: 409, description: 'Ce lien existe déjà' })
  linkAnimatorToTeacher(
    @Body() dto: CreateAnimatorTeacherLinkDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<RelationsService['linkAnimatorToTeacher']>>> {
    return this.relationsService.linkAnimatorToTeacher(dto, actor);
  }

  @Get('animator-teacher/:animatorId')
  @ApiOperation({
    summary: 'Lister les formateurs animés par un AP',
    description:
      "Renvoie les formateurs animés par l'AP désigné, enrichis de leur nom " +
      "(`teacherName`, résolu depuis le profil administratif) pour qu'aucun écran n'ait à " +
      'afficher un UUID. Accessible au RP, au TI et à l\'AP lui-même.',
  })
  @ApiParam({ name: 'animatorId', description: 'UUID du compte animateur pédagogique' })
  @ApiResponse({
    status: 200,
    description:
      'Liste des liens : `[{id, animatorId, teacherId, createdAt, teacherName}]` — ' +
      "`teacherName` vaut `null` si le formateur n'a pas de profil administratif",
  })
  @ApiResponse({ status: 403, description: 'Interdit — droits insuffisants' })
  getTeachersByAnimator(
    @Param('animatorId', ParseUUIDPipe) animatorId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<RelationsService['getTeachersByAnimator']>>> {
    return this.relationsService.getTeachersByAnimator(animatorId, actor);
  }
}
