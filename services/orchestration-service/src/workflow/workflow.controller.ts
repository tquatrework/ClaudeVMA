import {
  Controller, Post, Get, Param, Body, NotFoundException, UseGuards, Request,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { WorkflowEngineService } from './workflow-engine.service';
import { StartWorkflowDto } from './dto/start-workflow.dto';
import { WORKFLOW_DEFINITIONS } from './definitions';
import { JwtAuthGuard } from '../security/jwt-auth.guard';

class SuspendDto {
  @IsString() @IsNotEmpty() reason: string;
}

class ResumeDto {
  @IsOptional() @IsBoolean() tiOverride?: boolean;
}

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
  @ApiResponse({ status: 202, description: 'Workflow démarré' })
  @ApiResponse({ status: 404, description: 'Type de workflow inconnu' })
  async start(@Param('workflowId') workflowId: string, @Body() dto: StartWorkflowDto, @Request() req) {
    if (!WORKFLOW_DEFINITIONS[workflowId]) {
      throw new NotFoundException(`Workflow type "${workflowId}" inconnu`);
    }
    const initiatedBy = dto.initiatedBy ?? req.user?.id;
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
  @ApiResponse({ status: 200, description: 'Instance trouvée' })
  @ApiResponse({ status: 404, description: 'Instance introuvable' })
  async getOne(@Param('workflowInstanceId') workflowInstanceId: string) {
    const instance = await this.engine.getInstance(workflowInstanceId);
    if (!instance) throw new NotFoundException(`Instance "${workflowInstanceId}" introuvable`);
    return instance;
  }

  @Post(':workflowInstanceId/suspend')
  @ApiOperation({
    summary: 'Suspendre un workflow en attente d\'arbitrage utilisateur (ORCH-BR-006)',
    description: 'Passe le workflow en statut NEEDS_ARBITRATION. Doit être résolu avant de continuer.',
  })
  @ApiParam({ name: 'workflowInstanceId', description: 'UUID de l\'instance' })
  @ApiBody({ schema: { properties: { reason: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Workflow suspendu' })
  async suspend(
    @Param('workflowInstanceId') workflowInstanceId: string,
    @Body() dto: SuspendDto,
    @Request() req,
  ) {
    await this.engine.suspendForArbitration(workflowInstanceId, dto.reason, req.user?.id);
    return { workflowInstanceId, status: 'needs_arbitration', reason: dto.reason };
  }

  @Post(':workflowInstanceId/resume')
  @ApiOperation({
    summary: 'Reprendre un workflow après arbitrage ou forcage TI (ORCH-BR-006/007)',
    description: 'Relance l\'exécution. tiOverride=true permet au TI de forcer sans accord utilisateur — audité.',
  })
  @ApiParam({ name: 'workflowInstanceId', description: 'UUID de l\'instance' })
  @ApiBody({ schema: { properties: { tiOverride: { type: 'boolean' } } } })
  @ApiResponse({ status: 200, description: 'Workflow relancé' })
  async resume(
    @Param('workflowInstanceId') workflowInstanceId: string,
    @Body() dto: ResumeDto,
    @Request() req,
  ) {
    await this.engine.resumeAfterArbitration(workflowInstanceId, req.user?.id, dto.tiOverride ?? false);
    return { workflowInstanceId, status: 'in_progress', tiOverride: dto.tiOverride ?? false };
  }

  @Get()
  @ApiOperation({ summary: 'Lister les types de workflows disponibles' })
  @ApiResponse({ status: 200, description: 'Liste des définitions' })
  listDefinitions() {
    return Object.values(WORKFLOW_DEFINITIONS).map((definition) => ({
      id: definition.id,
      name: definition.name,
      phase: definition.phase,
      stepCount: definition.steps.length,
    }));
  }
}
