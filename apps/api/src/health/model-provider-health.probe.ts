import { Injectable } from '@nestjs/common';
import { loadDeepSeekModelRouterConfig } from '../model-router/providers/deepseek/deepseek-model-router.config';
import type { DependencyStatus,HealthProbe } from './health.types';

export function modelProviderConfigurationStatus(environment:NodeJS.ProcessEnv):DependencyStatus{try{switch(environment.MODEL_PROVIDER?.trim().toLowerCase()){case'deepseek':loadDeepSeekModelRouterConfig(environment);return'configured';default:return'not_configured';}}catch{return'not_configured';}}
@Injectable()
export class ModelProviderHealthProbe implements HealthProbe{check():DependencyStatus{return modelProviderConfigurationStatus(process.env);}}
