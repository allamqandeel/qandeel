import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { LiveCallReplyService } from '../conversation/live-call-reply.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { ConversationSemanticEstablishmentService } from '../live-focus/conversation-semantic-establishment.service';
import { LiveCallAnalysisSignal } from '../voice/call-turn/live-call-analysis.signal';
import type { BackgroundPermitGate } from './background-permits';
import { CallAnalysisRepository } from './call-analysis.repository';
import { CallAnalysisWorker, callAnalysisStart } from './call-analysis.worker';

/** S8B-05 CP3: the shared background permits of this process (A1 §3). */
export const BACKGROUND_PERMIT_GATE = Symbol('BACKGROUND_PERMIT_GATE');

/** The worker runs in every API instance except a test process, and can be switched off by configuration. */
export function callAnalysisWorkerEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.NODE_ENV !== 'test' && environment.LIVE_CALL_ANALYSIS_WORKER !== 'off';
}

/**
 * S8B-05 CP3: hosts the Durable Ordered Analysis Worker for the module's lifetime and registers it into VoiceModule's
 * LiveCallAnalysisSignal, so the live call's kicks reach it without a database call on the voice path. Several instances
 * may host it at once; migration 0191's claim keeps one active worker per session.
 */
@Injectable()
export class CallAnalysisWorkerHost implements OnModuleInit, OnModuleDestroy {
  private worker: CallAnalysisWorker | null = null;

  constructor(
    private readonly serviceApi: SupabaseServiceRoleApiService,
    private readonly semantic: ConversationSemanticEstablishmentService,
    @Inject(BACKGROUND_PERMIT_GATE) private readonly permits: BackgroundPermitGate,
    private readonly reply: LiveCallReplyService,
    private readonly signal: LiveCallAnalysisSignal,
  ) {}

  onModuleInit(): void {
    if (!callAnalysisWorkerEnabled()) return;
    this.worker = new CallAnalysisWorker({
      store: new CallAnalysisRepository(this.serviceApi),
      semantic: this.semantic,
      permits: this.permits,
      safety: this.reply,
      start: callAnalysisStart(),
    });
    this.signal.bind(this.worker);
    this.worker.start();
  }

  async onModuleDestroy(): Promise<void> {
    this.signal.bind(null);
    await this.worker?.stop();
    this.worker = null;
  }
}
