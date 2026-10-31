import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { loadMachineAsrMemoryConfidence, type MachineAsrMemoryConfidence } from '../../memory/memory-write-evaluator.service';
import { VoiceNotesRepository } from '../../voice-media/voice-notes.repository';
import { VOICE_NOTE_TRANSCRIPTION_WORKER_SETTINGS, type VoiceNoteTranscriptionWorkerSettings } from '../voice-note-transcription.worker';

/**
 * S8B-03 (CP1, E13 / A27) — the server's P-1 confidences (MACHINE_ASR_MEMORY_CONFIDENCE_HIGH / _MEDIUM) must equal the
 * database's band constants (`voice_private.machine_asr_memory_confidence_v1`, read through
 * `server_read_machine_asr_memory_confidence_v1`), because the database refuses any other confidence on a voice turn. A
 * difference, or an unreadable constant, refuses to start whenever voice notes can be transcribed (the worker is
 * configured); without the server key no voice turn exists, so no MACHINE_ASR confidence can be written.
 */
export async function assertMachineAsrConfidenceMatches(
  configured: MachineAsrMemoryConfidence,
  read: () => Promise<{ high: number; medium: number } | undefined>,
): Promise<void> {
  const constants = await read();
  if (!constants || Number(constants.high) !== configured.HIGH || Number(constants.medium) !== configured.MEDIUM) {
    throw new Error('MACHINE_ASR_MEMORY_CONFIDENCE_HIGH / _MEDIUM differ from the database band constants (0186); refusing to start.');
  }
}

@Injectable()
export class MachineAsrConfidenceStartupCheck implements OnModuleInit {
  constructor(
    private readonly notes: VoiceNotesRepository,
    @Inject(VOICE_NOTE_TRANSCRIPTION_WORKER_SETTINGS) private readonly settings: VoiceNoteTranscriptionWorkerSettings,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.settings.enabled) return;
    await assertMachineAsrConfidenceMatches(loadMachineAsrMemoryConfidence(), () => this.notes.readMachineAsrConfidence());
  }
}
