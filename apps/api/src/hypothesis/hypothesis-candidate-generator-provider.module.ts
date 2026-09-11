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

/**
 * Defers candidate-generator construction to the first generation. Same repair as
 * `deferredModelRouter`: Nest calls `useFactory` at bootstrap, so reading `GOOGLE_AI_API_KEY` there
 * made a provider credential a precondition of STARTING the API — and therefore of serving auth,
 * Session, temporal and projection, none of which generate a hypothesis candidate.
 *
 * Selection and validation are unchanged. An absent or invalid credential still throws the same
 * error, at the first generation. Generation still fails closed.
 */
export function deferredHypothesisCandidateGenerator(
  resolve: () => BoundHypothesisCandidateGenerator,
): BoundHypothesisCandidateGenerator {
  let resolved: BoundHypothesisCandidateGenerator | undefined;
  return {
    // `async` so a construction failure reaches the caller as a rejection, never as a synchronous
    // throw from a Promise-returning method.
    generate: async (request) => {
      resolved ??= resolve();
      return resolved.generate(request);
    },
  };
}

@Module({
  providers: [{
    provide: HYPOTHESIS_CANDIDATE_GENERATOR,
    useFactory: () => deferredHypothesisCandidateGenerator(() => createConfiguredHypothesisCandidateGenerator(process.env)),
  }],
  exports: [HYPOTHESIS_CANDIDATE_GENERATOR],
})
export class HypothesisCandidateGeneratorProviderModule {}
