import { Module } from '@nestjs/common';
import { FakeHypothesisCandidateGenerator } from './fake-hypothesis-candidate.generator';
import { GeminiHypothesisCandidateGenerator } from './gemini-hypothesis-candidate.generator';
import { HYPOTHESIS_CANDIDATE_GENERATOR, type BoundHypothesisCandidateGenerator } from './hypothesis-candidate-generator-provider.types';

export function createConfiguredHypothesisCandidateGenerator(
  environment: NodeJS.ProcessEnv = process.env,
): BoundHypothesisCandidateGenerator {
  if (environment.NODE_ENV === 'test') return new FakeHypothesisCandidateGenerator();
  return GeminiHypothesisCandidateGenerator.fromEnvironment(environment);
}

@Module({
  providers: [{
    provide: HYPOTHESIS_CANDIDATE_GENERATOR,
    useFactory: () => createConfiguredHypothesisCandidateGenerator(process.env),
  }],
  exports: [HYPOTHESIS_CANDIDATE_GENERATOR],
})
export class HypothesisCandidateGeneratorProviderModule {}
