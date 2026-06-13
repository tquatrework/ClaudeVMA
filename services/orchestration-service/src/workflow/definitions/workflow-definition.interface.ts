export interface WorkflowContext {
  payload: Record<string, any>;
  stepOutputs: Record<string, Record<string, any>>;
  correlationId: string;
}

export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
}

export interface WorkflowStepDefinition {
  order: number;
  name: string;
  targetService: string;
  action: string;
  buildPayload: (context: WorkflowContext) => Record<string, any>;
  optional?: boolean;
  retry?: RetryConfig;
  compensationAction?: string;
  buildCompensationPayload?: (context: WorkflowContext) => Record<string, any>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  phase: number;
  steps: WorkflowStepDefinition[];
}
