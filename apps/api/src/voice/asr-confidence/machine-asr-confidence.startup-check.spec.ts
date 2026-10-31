// S8B-03 (CP1, E13 / A27): the server refuses to start when its P-1 band confidences differ from the database constants.
import { MachineAsrConfidenceStartupCheck, assertMachineAsrConfidenceMatches } from './machine-asr-confidence.startup-check';
import type { VoiceNotesRepository } from '../../voice-media/voice-notes.repository';

const configured = { HIGH: 0.9, MEDIUM: 0.75 };

describe('MachineAsrConfidenceStartupCheck (E13)', () => {
  it('starts when the constants are equal', async () => {
    await expect(assertMachineAsrConfidenceMatches(configured, async () => ({ high: 0.9, medium: 0.75 }))).resolves.toBeUndefined();
  });

  it.each([
    ['a different HIGH', { high: 0.95, medium: 0.75 }],
    ['a different MEDIUM', { high: 0.9, medium: 0.7 }],
    ['no constants', undefined],
  ])('refuses to start on %s', async (_name, constants) => {
    await expect(assertMachineAsrConfidenceMatches(configured, async () => constants)).rejects.toThrow(/refusing to start/u);
  });

  it('reads nothing when the worker is not configured, and checks when it is', async () => {
    const readMachineAsrConfidence = jest.fn().mockResolvedValue({ high: 0.5, medium: 0.4 });
    const notes = { readMachineAsrConfidence } as unknown as VoiceNotesRepository;
    await expect(new MachineAsrConfidenceStartupCheck(notes, { enabled: false, concurrency: 1, thresholds: { high: 0.85, medium: 0.65 } }).onModuleInit()).resolves.toBeUndefined();
    expect(readMachineAsrConfidence).not.toHaveBeenCalled();
    await expect(new MachineAsrConfidenceStartupCheck(notes, { enabled: true, concurrency: 1, thresholds: { high: 0.85, medium: 0.65 } }).onModuleInit()).rejects.toThrow(/refusing to start/u);
  });
});
