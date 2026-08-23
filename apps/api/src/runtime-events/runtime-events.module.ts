import { Module } from '@nestjs/common';
import { RuntimeEventAdminRepository } from './runtime-event-admin.repository';
import { RedisStreamsTransport } from './redis-streams.transport';
import { RUNTIME_EVENT_TRANSPORT } from './runtime-event-transport';
import { RuntimeEventPublisher } from './runtime-event.publisher';
import { ObservabilityModule } from '../observability/observability.module';
@Module({imports:[ObservabilityModule],providers:[RuntimeEventAdminRepository,RedisStreamsTransport,{provide:RUNTIME_EVENT_TRANSPORT,useExisting:RedisStreamsTransport},RuntimeEventPublisher]})export class RuntimeEventsModule{}
