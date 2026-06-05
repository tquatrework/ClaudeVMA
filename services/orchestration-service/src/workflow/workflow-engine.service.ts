import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { WorkflowStatus } from '../common/enums/workflow-status.enum';
import { StepStatus } from '../common/enums/step-status.enum';
import { HttpClientService } from '../http-client/http-client.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
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
    private readonly httpClient: HttpClientService,
    private readonly idempotency: IdempotencyService,
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

    this.logger.log(`[${corrId}] Workflow ${workflowType} started — id=${instance.id}`);

    setImmediate(() => this.executeWorkflow(instance.id).catch((err) =>
      this.logger.error(`[${corrId}] Unhandled execution error: ${err.message}`),
    ));

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

    // Restore already-completed outputs into context
    for (const step of steps) {
      if (step.status === StepStatus.COMPLETED && step.output) {
        context.stepOutputs[step.stepName] = step.output;
      }
    }

    for (const step of steps) {
      if (step.status === StepStatus.COMPLETED || step.status === StepStatus.SKIPPED) continue;
      if (step.status === StepStatus.FAILED) break;

      const stepDef = definition.steps.find((d) => d.order === step.stepOrder);
      if (!stepDef) continue;

      // Idempotency check
      const cached = await this.idempotency.check(step.idempotencyKey);
      if (cached) {
        this.logger.log(`[${instance.correlationId}] Step ${step.stepName} — idempotent hit, reusing output`);
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

      const result = await this.httpClient.call({
        service: step.targetService,
        action: step.action,
        payload: step.input,
        correlationId: instance.correlationId,
        idempotencyKey: step.idempotencyKey,
      });

      if (result.success) {
        const output = result.data ?? {};
        step.status = StepStatus.COMPLETED;
        step.output = output;
        step.completedAt = new Date();
        await this.stepRepo.save(step);
        await this.idempotency.register(step.idempotencyKey, output);
        context.stepOutputs[step.stepName] = output;
        this.logger.log(`[${instance.correlationId}] Step ${step.stepName} completed`);
      } else {
        if (stepDef.optional) {
          step.status = StepStatus.SKIPPED;
          step.error = result.error;
          step.completedAt = new Date();
          await this.stepRepo.save(step);
          context.stepOutputs[step.stepName] = {};
          this.logger.warn(`[${instance.correlationId}] Optional step ${step.stepName} skipped: ${result.error}`);
          continue;
        }

        step.status = StepStatus.FAILED;
        step.error = result.error;
        step.completedAt = new Date();
        await this.stepRepo.save(step);

        await this.instanceRepo.update(instanceId, {
          status: WorkflowStatus.FAILED,
          error: `Step ${step.stepName} failed: ${result.error}`,
        });
        this.logger.error(`[${instance.correlationId}] Workflow ${instanceId} failed at step ${step.stepName}`);
        return;
      }

      await this.instanceRepo.update(instanceId, { currentStepIndex: step.stepOrder });
    }

    await this.instanceRepo.update(instanceId, { status: WorkflowStatus.COMPLETED });
    this.logger.log(`[${instance.correlationId}] Workflow ${instanceId} completed`);
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
