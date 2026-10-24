import { Module } from '@nestjs/common';
import { BackgroundIntelligenceModule } from '../background-intelligence/background-intelligence.module';
import { PersonalUnderstandingCaptureProviderModule } from './personal-understanding-capture-provider.module';
import { PersonalUnderstandingCaptureService } from './personal-understanding-capture.service';

// S8A-03 CP2: the background Personal Understanding capture. It reads only through the background enrichment facade
// (the raw data API stays private to BackgroundIntelligenceModule) and writes nothing itself: the post-response
// dispatcher hands its verified command to the ONE atomic 0171 command.
@Module({
  imports: [BackgroundIntelligenceModule, PersonalUnderstandingCaptureProviderModule],
  providers: [PersonalUnderstandingCaptureService],
  exports: [PersonalUnderstandingCaptureService],
})
export class PersonalUnderstandingModule {}
