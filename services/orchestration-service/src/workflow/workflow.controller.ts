import {
  Controller, Post, Get, Param, Body, NotFoundException, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam,
} from '@nestjs/swagger';
import { WorkflowEngineService } from './workflow-engine.service';
import { StartWorkflowDto } from './dto/start-workflow.dto';
import { WORKFLOW_DEFINITIONS } from './definitions';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

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
  @ApiResponse({ status: 400, description: 'Type de workflow inconnu' })
  async start(@Param('workflowId') workflowId: string, @Body() dto: StartWorkflowDto) {
    if (!WORKFLOW_DEFINITIONS[workflowId]) {
      throw new NotFoundException(`Workflow type "${workflowId}" inconnu`);
    }
    const instance = await this.engine.startWorkflow(
      workflowId,
      dto.payload,
      dto.initiatedBy,
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
  async getOne(@Param('workflowInstanceId') id: string) {
    const instance = await this.engine.getInstance(id);
    if (!instance) throw new NotFoundException(`Instance "${id}" introuvable`);
    return instance;
  }

  @Get()
  @ApiOperation({ summary: 'Lister les types de workflows disponibles' })
  @ApiResponse({ status: 200, description: 'Liste des définitions' })
  listDefinitions() {
    return Object.values(WORKFLOW_DEFINITIONS).map((d) => ({
      id: d.id,
      name: d.name,
      phase: d.phase,
      stepCount: d.steps.length,
    }));
  }
}
