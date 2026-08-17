import type { HypothesisStatus } from './hypothesis.types';
const TRANSITIONS: Readonly<Record<HypothesisStatus, ReadonlyArray<HypothesisStatus>>> = {
  CANDIDATE: ['ACTIVE'], ACTIVE: ['SUPPORTED', 'MIXED', 'WEAK', 'REJECTED', 'RETIRED'],
  SUPPORTED: ['MIXED', 'WEAK', 'REJECTED', 'RETIRED'], MIXED: ['SUPPORTED', 'WEAK', 'REJECTED', 'RETIRED'],
  WEAK: ['ACTIVE', 'MIXED', 'REJECTED', 'RETIRED'], REJECTED: ['REOPENED'], RETIRED: ['REOPENED'], REOPENED: ['ACTIVE'],
};
export function canTransitionHypothesis(from: HypothesisStatus, to: HypothesisStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
