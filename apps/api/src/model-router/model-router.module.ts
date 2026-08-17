import { Module } from '@nestjs/common';
import { FakeModelRouter } from './fake-model-router';
import { MODEL_ROUTER } from './model-router.types';

@Module({
  providers: [FakeModelRouter, { provide: MODEL_ROUTER, useExisting: FakeModelRouter }],
  exports: [MODEL_ROUTER],
})
export class ModelRouterModule {}
