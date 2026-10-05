// S4-02 — the provider list that composes the frozen Shared authority chain for the request-driven QANDEEL reply.
//
// It is a plain list, not a Nest module: Connected Worlds registers no module of its own (its namespace carries no
// controller, module, gateway or DTO), and the Shared World Product boundary — the one registered consumer — spreads
// this list into its own providers. Every service here is the frozen one, unchanged; the two dependency contracts no
// reviewed slice implements are bound fail-closed (see `shared-unavailable-private-context-boundaries.ts`). The
// generator port (`SHARED_QANDEEL_REPLY_GENERATOR`) is the consumer's to bind.

import type { Provider } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../../conversation/supabase-service-role-api.service';
import { SharedHumanAudienceResolverService } from '../audience/shared-human-audience-resolver.service';
import { StandingContextGrantResolverService } from '../authority-resolution/standing-context-grant-resolver.service';
import { SharedDeliveryAuthorityRevalidatorService } from '../delivery-authority/shared-delivery-authority-revalidator.service';
import { SHARED_PRIVATE_SOURCE_STATE_RESOLVER } from '../delivery-authority/shared-private-source-state-resolver.types';
import { SharedEffectiveContextService } from '../effective-context/shared-effective-context.service';
import { SharedPreModelWorldStateResolverService } from '../effective-context/shared-pre-model-world-state-resolver.service';
import { SharedPrivacyAuthorityDeliveryReadinessService } from '../source-disclosure/shared-privacy-authority-delivery-readiness.service';
import { SHARED_SOURCE_DISCLOSURE_DETECTOR } from '../source-disclosure/shared-source-disclosure-detector.types';
import { SharedSourceDisclosureGateService } from '../source-disclosure/shared-source-disclosure-gate.service';
import { SharedQandeelReplyService } from './shared-qandeel-reply.service';
import { UnimplementedPrivateSourceState, UnimplementedSourceDisclosureDetector } from './shared-unavailable-private-context-boundaries';

export const SHARED_QANDEEL_REPLY_PROVIDERS: ReadonlyArray<Provider> = Object.freeze([
  SupabaseServiceRoleApiService,
  SharedPreModelWorldStateResolverService,
  SharedHumanAudienceResolverService,
  StandingContextGrantResolverService,
  SharedEffectiveContextService,
  { provide: SHARED_SOURCE_DISCLOSURE_DETECTOR, useClass: UnimplementedSourceDisclosureDetector },
  { provide: SHARED_PRIVATE_SOURCE_STATE_RESOLVER, useClass: UnimplementedPrivateSourceState },
  SharedSourceDisclosureGateService,
  SharedDeliveryAuthorityRevalidatorService,
  SharedPrivacyAuthorityDeliveryReadinessService,
  SharedQandeelReplyService,
]);
