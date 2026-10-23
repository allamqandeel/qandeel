import { Test } from '@nestjs/testing';
import { BackgroundIntelligenceModule } from '../background-intelligence/background-intelligence.module';
import { PostResponseIntelligenceDispatcherService } from '../post-response-intelligence/post-response-intelligence-dispatcher.service';
import { PostResponseIntelligenceModule } from '../post-response-intelligence/post-response-intelligence.module';
import { PersonalUnderstandingCaptureService } from './personal-understanding-capture.service';
import { PersonalUnderstandingModule } from './personal-understanding.module';

// S8A-03 CP2: the dispatcher's capture dependency is @Optional (hand-built test dispatchers omit it), so the WIRING is
// what guarantees the stage runs in the application. A module that stopped supplying it would silently disable natural
// acquisition; these assertions make that a test failure instead.
describe('PersonalUnderstandingModule composition (S8A-03 CP2)', () => {
  it('resolves the capture service through the real modules, on the fake provider in test mode', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [PersonalUnderstandingModule] }).compile();
    const service = moduleRef.get(PersonalUnderstandingCaptureService);
    expect(service).toBeInstanceOf(PersonalUnderstandingCaptureService);
    const provider = (service as unknown as { provider: { capture: (r: unknown) => Promise<unknown> } }).provider;
    await expect(provider.capture({ schemaVersion: 1, currentUserText: 'أنا ساكن في المعادي', memories: [] })).resolves.toEqual({ facts: [], memories: [], context: [] });
    await moduleRef.close();
  });

  it('is imported by the post-response module and is the dispatcher\'s tenth constructor dependency', () => {
    expect(Reflect.getMetadata('imports', PostResponseIntelligenceModule)).toContain(PersonalUnderstandingModule);
    expect(Reflect.getMetadata('design:paramtypes', PostResponseIntelligenceDispatcherService)[9]).toBe(PersonalUnderstandingCaptureService);
  });

  it('leaves the background module\'s exports exactly the authority and the enrichment facade', () => {
    expect(Reflect.getMetadata('exports', BackgroundIntelligenceModule)).toHaveLength(2);
    expect(Reflect.getMetadata('exports', PersonalUnderstandingModule)).toEqual([PersonalUnderstandingCaptureService]);
  });
});
