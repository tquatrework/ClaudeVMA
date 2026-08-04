import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { CompensationAction, CompensationStatus } from './entities/compensation-action.entity';
import { RetryPolicy } from './entities/retry-policy.entity';
import { WorkflowStatus } from '../common/enums/workflow-status.enum';
import { StepStatus } from '../common/enums/step-status.enum';
import { HttpClientService } from '../http-client/http-client.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { EventService } from '../event/event.service';
import { EventDirection } from '../event/entities/integration-event.entity';
import { CorrelationTraceService } from '../correlation/correlation-trace.service';
import { WORKFLOW_DEFINITIONS } from './definitions';
import { WorkflowContext } from './definitions/workflow-definition.interface';
import { WorkflowPayloadValidatorService } from './workflow-payload-validator.service';

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    @InjectRepository(WorkflowInstance)
    private readonly instanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowStep)
    private readonly stepRepo: Repository<WorkflowStep>,
    @InjectRepository(CompensationAction)
    private readonly compensationRepo: Repository<CompensationAction>,
    @InjectRepository(RetryPolicy)
    private readonly retryRepo: Repository<RetryPolicy>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly httpClient: HttpClientService,
    private readonly idempotency: IdempotencyService,
    private readonly eventService: EventService,
    private readonly correlationTrace: CorrelationTraceService,
    private readonly payloadValidator: WorkflowPayloadValidatorService,
  ) {}

  async startWorkflow(
    workflowType: string,
    payload: Record<string, any>,
    initiatedBy?: string,
    correlationId?: string,
  ): Promise<WorkflowInstance> {
    const definition = WORKFLOW_DEFINITIONS[workflowType];
    if (!definition) throw new Error(`Unknown workflow type: ${workflowType}`);

    // Le payload doit être validé avant toute écriture (instance/étapes) ou
    // appel à un service cible : un payload incomplet doit échouer proprement
    // dès l'entrée, jamais silencieusement plus loin dans la chaîne.
    await this.payloadValidator.validateStartPayload(definition, payload);

    const resolvedCorrelationId = correlationId ?? uuidv4();

    // La création de l'instance et de ses étapes doit rester atomique : un
    // crash entre les deux écritures laisserait un workflow "en cours" sans
    // aucune étape à exécuter. Les deux repositories appartiennent tous les
    // deux à la feature workflow, donc partager le même EntityManager de
    // transaction ne viole pas les frontières de possession des entités.
    const { instance, steps } = await this.dataSource.transaction(async (manager) => {
      const instanceRepo = manager.getRepository(WorkflowInstance);
      const stepRepo = manager.getRepository(WorkflowStep);

      const instanceEntity = instanceRepo.create({
        workflowType,
        correlationId: resolvedCorrelationId,
        status: WorkflowStatus.IN_PROGRESS,
        payload,
        context: {},
        initiatedBy,
        currentStepIndex: 0,
      });
      const savedInstance = await instanceRepo.save(instanceEntity);

      const stepEntities = definition.steps.map((def) =>
        stepRepo.create({
          workflowInstanceId: savedInstance.id,
          stepOrder: def.order,
          stepName: def.name,
          targetService: def.targetService,
          action: def.action,
          status: StepStatus.PENDING,
          idempotencyKey: this.httpClient.buildStepIdempotencyKey(savedInstance.id, def.order),
        }),
      );
      const savedSteps = await stepRepo.save(stepEntities);

      return { instance: savedInstance, steps: savedSteps };
    });

    // Les événements et traces d'audit ne sont publiés qu'après le commit de
    // la transaction ci-dessus (jamais avant, jamais dans la transaction).
    await this.eventService.record('WorkflowStarted', resolvedCorrelationId, EventDirection.PUBLISHED, {
      workflowInstanceId: instance.id,
      workflowType,
      initiatedBy,
    });
    await this.correlationTrace.record(resolvedCorrelationId, 'workflow', 'WorkflowStarted', {
      entityId: instance.id,
      metadata: { workflowType, stepCount: steps.length },
      actor: initiatedBy,
    });

    this.logger.log(`[${resolvedCorrelationId}] Workflow ${workflowType} started — id=${instance.id}`);

    setImmediate(() =>
      this.executeWorkflow(instance.id).catch((err) =>
        this.logger.error(`[${resolvedCorrelationId}] Unhandled execution error: ${err.message}`),
      ),
    );

    return instance;
  }

  async executeWorkflow(instanceId: string): Promise<void> {
    const instance = await this.instanceRepo.findOne({ where: { id: instanceId } });
    if (!instance) return;

    const definition = WORKFLOW_DEFINITIONS[instance.workflowType];
    const steps = await this.stepRepo.find({
      where: { workflowInstanceId: instanceId },
      order: { stepOrder: 'ASC' },
    });

    const context: WorkflowContext = {
      payload: instance.payload ?? {},
      stepOutputs: {},
      correlationId: instance.correlationId,
    };

    for (const step of steps) {
      if (step.status === StepStatus.COMPLETED && step.output) {
        context.stepOutputs[step.stepName] = step.output;
      }
    }

    for (const step of steps) {
      if (step.status === StepStatus.COMPLETED || step.status === StepStatus.SKIPPED) continue;
      if (step.status === StepStatus.FAILED) break;
      if (instance.status === WorkflowStatus.NEEDS_ARBITRATION) break;

      const stepDef = definition.steps.find((stepDefinition) => stepDefinition.order === step.stepOrder);
      if (!stepDef) continue;

      const cached = await this.idempotency.check(step.idempotencyKey);
      if (cached) {
        this.logger.log(`[${instance.correlationId}] Step ${step.stepName} — idempotent hit`);
        step.status = StepStatus.COMPLETED;
        step.output = cached;
        step.completedAt = new Date();
        await this.stepRepo.save(step);
        context.stepOutputs[step.stepName] = cached;
        continue;
      }

      step.status = StepStatus.IN_PROGRESS;
      step.startedAt = new Date();
      step.input = stepDef.buildPayload(context);
      await this.stepRepo.save(step);

      const maxAttempts = stepDef.retry?.maxAttempts ?? 1;
      const delayMs = stepDef.retry?.delayMs ?? 0;
      let lastError: string | undefined;
      let success = false;
      let output: Record<string, any> = {};

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        const result = await this.httpClient.call({
          service: step.targetService,
          action: step.action,
          payload: step.input,
          correlationId: instance.correlationId,
          idempotencyKey: step.idempotencyKey,
        });

        if (result.success) {
          success = true;
          output = result.data ?? {};
          break;
        }

        lastError = result.error;
        if (attempt < maxAttempts) {
          await this.retryRepo.save(
            this.retryRepo.create({
              workflowStepId: step.id,
              workflowInstanceId: instanceId,
              attemptNumber: attempt,
              error: lastError,
              retriedAfterThis: true,
            }),
          );
          this.logger.warn(
            `[${instance.correlationId}] Step ${step.stepName} attempt ${attempt}/${maxAttempts} failed — retrying`,
          );
        }
      }

      if (success) {
        step.status = StepStatus.COMPLETED;
        step.output = output;
        step.completedAt = new Date();
        await this.stepRepo.save(step);
        await this.idempotency.register(step.idempotencyKey, output);
        context.stepOutputs[step.stepName] = output;

        if (stepDef.compensationAction) {
          await this.compensationRepo.save(
            this.compensationRepo.create({
              workflowInstanceId: instanceId,
              stepName: step.stepName,
              targetService: step.targetService,
              compensationAction: stepDef.compensationAction,
              payload: stepDef.buildCompensationPayload?.(context) ?? {},
              status: CompensationStatus.PENDING,
            }),
          );
        }

        await this.eventService.record('WorkflowStepCompleted', instance.correlationId, EventDirection.PUBLISHED, {
          workflowInstanceId: instanceId,
          stepName: step.stepName,
          stepOrder: step.stepOrder,
        });
        this.logger.log(`[${instance.correlationId}] Step ${step.stepName} completed`);
      } else {
        if (stepDef.optional) {
          step.status = StepStatus.SKIPPED;
          step.error = lastError;
          step.completedAt = new Date();
          await this.stepRepo.save(step);
          context.stepOutputs[step.stepName] = {};
          this.logger.warn(`[${instance.correlationId}] Optional step ${step.stepName} skipped: ${lastError}`);
          continue;
        }

        step.status = StepStatus.FAILED;
        step.error = lastError;
        step.completedAt = new Date();
        await this.stepRepo.save(step);

        // L'instance est mise à jour d'abord ; l'événement n'est publié
        // qu'une fois ce changement d'état persisté (jamais avant écriture).
        await this.instanceRepo.update(instanceId, {
          status: WorkflowStatus.COMPENSATING,
          error: `Step ${step.stepName} failed: ${lastError}`,
        });
        await this.eventService.record('WorkflowFailed', instance.correlationId, EventDirection.PUBLISHED, {
          workflowInstanceId: instanceId,
          failedStep: step.stepName,
          error: lastError,
        });
        this.logger.error(`[${instance.correlationId}] Step ${step.stepName} failed — starting compensation`);

        await this.runCompensation(instanceId, instance.correlationId, context);
        return;
      }

      await this.instanceRepo.update(instanceId, { currentStepIndex: step.stepOrder });
    }

    const current = await this.instanceRepo.findOne({ where: { id: instanceId } });
    if (current?.status === WorkflowStatus.NEEDS_ARBITRATION) return;

    await this.instanceRepo.update(instanceId, { status: WorkflowStatus.COMPLETED });
    await this.correlationTrace.record(instance.correlationId, 'workflow', 'WorkflowCompleted', {
      entityId: instanceId,
    });
    this.logger.log(`[${instance.correlationId}] Workflow ${instanceId} completed`);
  }

  private async runCompensation(
    instanceId: string,
    correlationId: string,
    context: WorkflowContext,
  ): Promise<void> {
    const actions = await this.compensationRepo.find({
      where: { workflowInstanceId: instanceId, status: CompensationStatus.PENDING },
      order: { registeredAt: 'DESC' },
    });

    for (const action of actions) {
      const result = await this.httpClient.call({
        service: action.targetService,
        action: action.compensationAction,
        payload: action.payload,
        correlationId,
        idempotencyKey: `comp:${action.id}`,
      });

      action.status = result.success ? CompensationStatus.COMPLETED : CompensationStatus.FAILED;
      action.result = result.data ?? null;
      action.error = result.error ?? null;
      action.executedAt = new Date();
      await this.compensationRepo.save(action);

      this.logger.log(
        `[${correlationId}] Compensation ${action.compensationAction} on ${action.stepName}: ${action.status}`,
      );
    }

    await this.instanceRepo.update(instanceId, { status: WorkflowStatus.COMPENSATED });
    await this.eventService.record('WorkflowCompensated', correlationId, EventDirection.PUBLISHED, {
      workflowInstanceId: instanceId,
    });
  }

  async suspendForArbitration(instanceId: string, reason: string, actor?: string): Promise<void> {
    const instance = await this.instanceRepo.findOne({ where: { id: instanceId } });
    if (!instance) return;

    await this.instanceRepo.update(instanceId, {
      status: WorkflowStatus.NEEDS_ARBITRATION,
      error: reason,
    });
    await this.correlationTrace.record(instance.correlationId, 'workflow', 'WorkflowSuspendedForArbitration', {
      entityId: instanceId,
      metadata: { reason },
      actor,
    });
    this.logger.warn(`[${instance.correlationId}] Workflow ${instanceId} suspended: ${reason}`);
  }

  async resumeAfterArbitration(instanceId: string, actor: string, isTiOverride = false): Promise<void> {
    const instance = await this.instanceRepo.findOne({ where: { id: instanceId } });
    if (!instance || instance.status !== WorkflowStatus.NEEDS_ARBITRATION) return;

    await this.instanceRepo.update(instanceId, { status: WorkflowStatus.IN_PROGRESS, error: null });
    await this.correlationTrace.record(instance.correlationId, 'workflow', 'WorkflowResumed', {
      entityId: instanceId,
      metadata: { isTiOverride },
      actor,
      isTiOverride,
    });

    setImmediate(() =>
      this.executeWorkflow(instanceId).catch((err) =>
        this.logger.error(`[${instance.correlationId}] Resume error: ${err.message}`),
      ),
    );
  }

  async getInstance(instanceId: string): Promise<WorkflowInstance & { steps: WorkflowStep[] }> {
    const instance = await this.instanceRepo.findOne({ where: { id: instanceId } });
    if (!instance) return null;
    const steps = await this.stepRepo.find({
      where: { workflowInstanceId: instanceId },
      order: { stepOrder: 'ASC' },
    });
    return { ...instance, steps };
  }
}
