import { Injectable } from '@nestjs/common';
import { loadOpenAIModelRouterConfig } from '../model-router/providers/openai/openai-model-router.config';
import { loadClaudeModelRouterConfig } from '../model-router/providers/anthropic/claude-model-router.config';
import type { DependencyStatus,HealthProbe } from './health.types';

export function modelProviderConfigurationStatus(environment:NodeJS.ProcessEnv):DependencyStatus{try{switch(environment.MODEL_PROVIDER?.trim().toLowerCase()){case'openai':loadOpenAIModelRouterConfig(environment);return'configured';case'anthropic':loadClaudeModelRouterConfig(environment);return'configured';default:return'not_configured';}}catch{return'not_configured';}}
@Injectable()
export class ModelProviderHealthProbe implements HealthProbe{check():DependencyStatus{return modelProviderConfigurationStatus(process.env);}}

