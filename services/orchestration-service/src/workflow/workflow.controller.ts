import {
  Controller, Post, Get, Param, ParseUUIDPipe, Body, NotFoundException, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody,
} from '@nestjs/swagger';
import { WorkflowEngineService } from './workflow-engine.service';
import { StartWorkflowDto } from './dto/start-workflow.dto';
import { SuspendWorkflowDto } from './dto/suspend-workflow.dto';
import { ResumeWorkflowDto } from './dto/resume-workflow.dto';
import { StartWorkflowResponseDto } from './dto/start-workflow-response.dto';
import { WorkflowInstanceResponseDto } from './dto/workflow-instance-response.dto';
import { SuspendWorkflowResponseDto } from './dto/suspend-workflow-response.dto';
import { ResumeWorkflowResponseDto } from './dto/resume-workflow-response.dto';
import { WorkflowDefinitionSummaryDto } from './dto/workflow-definition-summary.dto';
import { WORKFLOW_DEFINITIONS } from './definitions';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workflows')
export class WorkflowController {
  constructor(private readonly engine: WorkflowEngineService) {}

  @Post(':workflowId/start')
  @ApiOperation({
    summary: 'Déclencher un workflow transverse',
    description: 'Lance un workflow par son type (ex: student-onboarding). L\'exécution est asynchrone.',
  })
  @ApiParam({ name: 'workflowId', description: 'Type de workflow', example: 'student-onboarding' })
  @ApiResponse({ status: 202, description: 'Workflow démarré', type: StartWorkflowResponseDto })
  @ApiResponse({ status: 404, description: 'Type de workflow inconnu' })
  async start(
    @Param('workflowId') workflowId: string,
    @Body() dto: StartWorkflowDto,
    @CurrentUser() actor?: AuthenticatedUser,
  ): Promise<StartWorkflowResponseDto> {
    if (!WORKFLOW_DEFINITIONS[workflowId]) {
      throw new NotFoundException(`Workflow type "${workflowId}" inconnu`);
    }
    const initiatedBy = dto.initiatedBy ?? actor?.id;
    const instance = await this.engine.startWorkflow(
      workflowId,
      dto.payload,
      initiatedBy,
      dto.correlationId,
    );
    return {
      workflowInstanceId: instance.id,
      workflowType: instance.workflowType,
      correlationId: instance.correlationId,
      status: instance.status,
      startedAt: instance.createdAt,
    };
  }

  @Get(':workflowInstanceId')
  @ApiOperation({
    summary: 'Lire l\'état d\'une instance de workflow',
    description: 'Retourne l\'instance, ses étapes et leur statut courant.',
  })
  @ApiParam({ name: 'workflowInstanceId', description: 'UUID de l\'instance' })
  @ApiResponse({ status: 200, description: 'Instance trouvée', type: WorkflowInstanceResponseDto })
  @ApiResponse({ status: 404, description: 'Instance introuvable' })
  async getOne(
    @Param('workflowInstanceId', ParseUUIDPipe) workflowInstanceId: string,
  ): Promise<WorkflowInstanceResponseDto> {
    const instance = await this.engine.getInstance(workflowInstanceId);
    if (!instance) throw new NotFoundException(`Instance "${workflowInstanceId}" introuvable`);
    return WorkflowInstanceResponseDto.fromEntity(instance, instance.steps);
  }

  @Post(':workflowInstanceId/suspend')
  @ApiOperation({
    summary: 'Suspendre un workflow en attente d\'arbitrage utilisateur (ORCH-BR-006)',
    description: 'Passe le workflow en statut NEEDS_ARBITRATION. Doit être résolu avant de continuer.',
  })
  @ApiParam({ name: 'workflowInstanceId', description: 'UUID de l\'instance' })
  @ApiBody({ type: SuspendWorkflowDto })
  @ApiResponse({ status: 200, description: 'Workflow suspendu', type: SuspendWorkflowResponseDto })
  async suspend(
    @Param('workflowInstanceId', ParseUUIDPipe) workflowInstanceId: string,
    @Body() dto: SuspendWorkflowDto,
    @CurrentUser() actor?: AuthenticatedUser,
  ): Promise<SuspendWorkflowResponseDto> {
    await this.engine.suspendForArbitration(workflowInstanceId, dto.reason, actor?.id);
    return { workflowInstanceId, status: 'needs_arbitration', reason: dto.reason };
  }

  @Post(':workflowInstanceId/resume')
  @ApiOperation({
    summary: 'Reprendre un workflow après arbitrage ou forcage TI (ORCH-BR-006/007)',
    description: 'Relance l\'exécution. tiOverride=true permet au TI de forcer sans accord utilisateur — audité.',
  })
  @ApiParam({ name: 'workflowInstanceId', description: 'UUID de l\'instance' })
  @ApiBody({ type: ResumeWorkflowDto })
  @ApiResponse({ status: 200, description: 'Workflow relancé', type: ResumeWorkflowResponseDto })
  async resume(
    @Param('workflowInstanceId', ParseUUIDPipe) workflowInstanceId: string,
    @Body() dto: ResumeWorkflowDto,
    @CurrentUser() actor?: AuthenticatedUser,
  ): Promise<ResumeWorkflowResponseDto> {
    await this.engine.resumeAfterArbitration(workflowInstanceId, actor?.id, dto.tiOverride ?? false);
    return { workflowInstanceId, status: 'in_progress', tiOverride: dto.tiOverride ?? false };
  }

  @Get()
  @ApiOperation({ summary: 'Lister les types de workflows disponibles' })
  @ApiResponse({ status: 200, description: 'Liste des définitions', type: [WorkflowDefinitionSummaryDto] })
  listDefinitions(): WorkflowDefinitionSummaryDto[] {
    return Object.values(WORKFLOW_DEFINITIONS).map((definition) => ({
      id: definition.id,
      name: definition.name,
      phase: definition.phase,
      stepCount: definition.steps.length,
    }));
  }
}
