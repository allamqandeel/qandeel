import { Injectable } from '@nestjs/common';
import { RuntimeEventPublisher } from '../runtime-events/runtime-event.publisher';
import type { DependencyStatus,HealthProbe } from './health.types';
@Injectable()
export class RuntimeEventsHealthProbe implements HealthProbe{constructor(private readonly publisher:RuntimeEventPublisher){}check():DependencyStatus{return this.publisher.readinessStatus;}}

