export type ProcessingPath = 'FAST' | 'DEEP';

export interface ModelRouterContextMessage {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

export interface ModelRouterRequest {
  task: 'CONVERSATIONAL_RESPONSE';
  path: ProcessingPath;
  complexity: 'LOW' | 'HIGH';
  context: ReadonlyArray<ModelRouterContextMessage>;
  locale: 'ar' | 'en' | 'und';
  modality: 'TEXT';
  latencyBudgetMs: number;
  costBudget: 'LOW';
  safetyLevel: 'STANDARD';
}

export interface ModelRouterResult {
  content: string;
  routingMetadata: { path: ProcessingPath };
}

export const MODEL_ROUTER = Symbol('MODEL_ROUTER');
export interface ModelRouter { generate(request: ModelRouterRequest): Promise<ModelRouterResult>; }
