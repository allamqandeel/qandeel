import { Injectable } from '@nestjs/common';
import { telemetrySdk } from '../observability/instrumentation';
import { sentryInitialized } from '../observability/sentry';
import type { DependencyStatus,HealthProbe } from './health.types';
export function observabilityConfigurationStatus(environment:NodeJS.ProcessEnv,state:{otel:boolean;sentry:boolean}):DependencyStatus{const otelConfigured=Boolean(environment.OTEL_EXPORTER_OTLP_ENDPOINT||environment.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT||environment.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT),sentryConfigured=Boolean(environment.SENTRY_DSN);if(!otelConfigured&&!sentryConfigured)return'not_configured';if((otelConfigured&&!state.otel)||(sentryConfigured&&!state.sentry))return'degraded';return'configured';}
@Injectable()
export class ObservabilityHealthProbe implements HealthProbe{check():DependencyStatus{return observabilityConfigurationStatus(process.env,{otel:Boolean(telemetrySdk),sentry:sentryInitialized});}}

