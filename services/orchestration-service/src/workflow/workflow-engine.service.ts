import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    private readonly httpClient: HttpClientService,
    private readonly idempotency: IdempotencyService,
    private readonly eventService: EventService,
    private readonly correlationTrace: CorrelationTraceService,
  ) {}

  async startWorkflow(
    workflowType: string,
    payload: Record<string, any>,
    initiatedBy?: string,
    correlationId?: string,
  ): Promise<WorkflowInstance> {
    const definition = WORKFLOW_DEFINITIONS[workflowType];
    if (!definition) throw new Error(`Unknown workflow type: ${workflowType}`);

    const corrId = correlationId ?? uuidv4();

    const instance = this.instanceRepo.create({
      workflowType,
      correlationId: corrId,
      status: WorkflowStatus.IN_PROGRESS,
      payload,
      context: {},
      initiatedBy,
      currentStepIndex: 0,
    });
    await this.instanceRepo.save(instance);

    const steps = definition.steps.map((def) =>
      this.stepRepo.create({
        workflowInstanceId: instance.id,
        stepOrder: def.order,
        stepName: def.name,
        targetService: def.targetService,
        action: def.action,
        status: StepStatus.PENDING,
        idempotencyKey: this.httpClient.buildStepIdempotencyKey(instance.id, def.order),
      }),
    );
    await this.stepRepo.save(steps);

    await this.eventService.record('WorkflowStarted', corrId, EventDirection.PUBLISHED, {
      workflowInstanceId: instance.id,
      workflowType,
      initiatedBy,
    });
    await this.correlationTrace.record(corrId, 'workflow', 'WorkflowStarted', {
      entityId: instance.id,
      metadata: { workflowType, stepCount: steps.length },
      actor: initiatedBy,
    });

    this.logger.log(`[${corrId}] Workflow ${workflowType} started — id=${instance.id}`);

    setImmediate(() =>
      this.executeWorkflow(instance.id).catch((err) =>
        this.logger.error(`[${corrId}] Unhandled execution error: ${err.message}`),
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

      const stepDef = definition.steps.find((d) => d.order === step.stepOrder);
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
          await new Promise((r) => setTimeout(r, delayMs));
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

        await this.eventService.record('WorkflowFailed', instance.correlationId, EventDirection.PUBLISHED, {
          workflowInstanceId: instanceId,
          failedStep: step.stepName,
          error: lastError,
        });

        await this.instanceRepo.update(instanceId, {
          status: WorkflowStatus.COMPENSATING,
          error: `Step ${step.stepName} failed: ${lastError}`,
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

    await this.eventService.record('WorkflowCompensated', correlationId, EventDirection.PUBLISHED, {
      workflowInstanceId: instanceId,
    });
    await this.instanceRepo.update(instanceId, { status: WorkflowStatus.COMPENSATED });
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

  async getInstance(id: string): Promise<WorkflowInstance & { steps: WorkflowStep[] }> {
    const instance = await this.instanceRepo.findOne({ where: { id } });
    if (!instance) return null;
    const steps = await this.stepRepo.find({
      where: { workflowInstanceId: id },
      order: { stepOrder: 'ASC' },
    });
    return { ...instance, steps };
  }
}
