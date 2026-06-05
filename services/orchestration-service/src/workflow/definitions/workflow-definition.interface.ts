export interface WorkflowContext {
  payload: Record<string, any>;
  stepOutputs: Record<string, Record<string, any>>;
  correlationId: string;
}

export interface WorkflowStepDefinition {
  order: number;
  name: string;
  targetService: string;
  action: string;
  buildPayload: (ctx: WorkflowContext) => Record<string, any>;
  optional?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  phase: number;
  steps: WorkflowStepDefinition[];
}
