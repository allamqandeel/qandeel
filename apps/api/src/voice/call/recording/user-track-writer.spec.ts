import { readOggOpus } from '../codec/ogg-opus';
import { OpusPacketDecoder } from '../codec/opus-codec';
import { InMemoryCallAuthority } from '../testing/in-memory-call-authority';
import { syntheticUplinkPackets } from '../testing/synthetic-voice';
import { UserTrackWriter } from './user-track-writer';

const USER = '00000000-0000-4000-8000-0000000000a1';
const CALL = '00000000-0000-4000-8000-0000000000c1';
const PACKETS = syntheticUplinkPackets(800);

async function started(authority = new InMemoryCallAuthority()) {
  await authority.begin({ userId: USER, sessionId: CALL, callId: CALL, clientInstanceId: CALL });
  const activated = await authority.activate({ userId: USER, callId: CALL, epoch: 1 });
  const writer = new UserTrackWriter({ media: authority, store: authority, userId: USER, callId: CALL }, activated.recordingId!, { userTrackEndMs: 0, userNextSegment: 0 });
  return { authority, writer };
}

function feed(writer: UserTrackWriter, from: number, count: number, captureStart: number): void {
  for (let i = 0; i < count; i += 1) writer.append(PACKETS[from + i]!, captureStart + i * 20);
}

describe('S8B-05 CP1 the USER track writer (real Opus packets, valid Ogg segments)', () => {
  it('cuts ten-second segments on the capture clock, each a valid decodable Ogg Opus file holding exactly its packets', async () => {
    const { authority, writer } = await started();
    feed(writer, 0, 760, 0);
    await writer.close();
    expect(authority.segments.map((s) => [s.index, s.startMs, s.endMs])).toEqual([[0, 0, 10_000], [1, 10_000, 15_200]]);
    const decoder = new OpusPacketDecoder(16_000);
    try {
      let at = 0;
      for (const segment of authority.segments) {
        const ogg = readOggOpus(segment.bytes);
        expect(ogg.packets.length).toBe((segment.endMs - segment.startMs) / 20);
        for (const packet of ogg.packets) {
          expect(packet.equals(PACKETS[at]!)).toBe(true); // the packets exactly as received
          expect(decoder.decode(packet).length).toBe(640);
          at += 1;
        }
      }
      expect(at).toBe(760);
    } finally {
      decoder.close();
    }
    expect(writer.pendingBytes).toBe(0);
    expect(writer.counts).toEqual({ segments: 2, packets: 760, gaps: 0, dropped: 0 });
  });

  it('records a hole as a gap row, never as invented audio, and keeps the track contiguous', async () => {
    const { authority, writer } = await started();
    feed(writer, 0, 50, 0);
    writer.gap('MUTED', 3000);
    feed(writer, 50, 50, 3000);
    await writer.close();
    expect(authority.segments.map((s) => [s.startMs, s.endMs])).toEqual([[0, 1000], [3000, 4000]]);
    expect(authority.gaps).toEqual([{ track: 'USER', startMs: 1000, endMs: 3000, kind: 'MUTED' }]);
    expect(() => writer.append(PACKETS[0]!, 0)).not.toThrow(); // closed: refused silently
    const fresh = await started();
    expect(() => fresh.writer.append(PACKETS[0]!, 20)).toThrow('USER_TRACK_NOT_CONTIGUOUS');
  });

  it('adopts the database answer when a write answered ambiguously after its add landed (no duplicate, no overwrite)', async () => {
    const { authority, writer } = await started();
    authority.failNextWrites = { outcome: 'UNAVAILABLE', count: 1, landed: true };
    feed(writer, 0, 600, 0);
    await writer.close();
    expect(writer.failure).toBeNull();
    expect(authority.segments.map((s) => [s.index, s.startMs, s.endMs])).toEqual([[0, 0, 10_000], [1, 10_000, 12_000]]);
  });

  it('retries once, contiguously, when the ambiguous write did not land', async () => {
    const { authority, writer } = await started();
    authority.failNextWrites = { outcome: 'UNAVAILABLE', count: 1, landed: false };
    feed(writer, 0, 100, 0);
    await writer.close();
    expect(writer.failure).toBeNull();
    expect(authority.segments.map((s) => [s.index, s.startMs, s.endMs])).toEqual([[0, 0, 2000]]);
  });

  it('drops what another writer already stored (a resend after a takeover) and keeps the rest', async () => {
    const { authority, writer: first } = await started();
    feed(first, 0, 100, 0);
    await first.flush();
    // A second writer that believes the track ends at 1000 ms (a stale view) resends 1000..2000 then continues.
    const second = new UserTrackWriter({ media: authority, store: authority, userId: USER, callId: CALL }, authority.calls.get(CALL)!.recordingId!,
      { userTrackEndMs: 1000, userNextSegment: 0 });
    feed(second, 50, 100, 1000);
    await second.close();
    expect(second.failure).toBeNull();
    expect(second.counts.dropped).toBe(50);
    expect(authority.segments.map((s) => [s.index, s.startMs, s.endMs])).toEqual([[0, 0, 2000], [1, 2000, 3000]]);
  });

  it('stops with an explicit failure when consent is gone or the recording is closed', async () => {
    const consent = await started();
    consent.authority.consent = false;
    feed(consent.writer, 0, 500, 0);
    await consent.writer.flush();
    expect(consent.writer.failure).toBe('CONSENT_REQUIRED');

    const closed = await started();
    closed.authority.recordingState = 'STORED';
    feed(closed.writer, 0, 500, 0);
    await closed.writer.flush();
    expect(closed.writer.failure).toBe('RECORDING_CLOSED');
    expect(closed.authority.segments).toEqual([]);
  });

  it('abandons without writing when the call ended without it', async () => {
    const { authority, writer } = await started();
    feed(writer, 0, 100, 0);
    await writer.close(true);
    expect(authority.segments).toEqual([]);
    expect(writer.pendingBytes).toBe(0);
  });
});
