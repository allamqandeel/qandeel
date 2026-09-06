import { sessionPosition } from '../../state/classes';
import { disclosedTrack } from '../model/disclosedTrack';

export function fixture(count: number, sessionId = 'current-session') {
  return disclosedTrack(sessionId, Array.from({ length: count }, (_, index) => ({ sessionPosition: sessionPosition(index + 1) })));
}
