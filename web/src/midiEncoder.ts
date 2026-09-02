import type { RollNote } from "./pianoroll";

/**
 * Encodes variable-length quantity (VLQ) for MIDI stream.
 */
function encodeVLQ(num: number): number[] {
  const bytes: number[] = [];
  let value = Math.max(0, Math.floor(num));
  bytes.push(value & 0x7f);
  while (value >> 7 > 0) {
    value >>= 7;
    bytes.unshift((value & 0x7f) | 0x80);
  }
  return bytes;
}

/**
 * Converts a list of RollNote objects into a standard Type 0 MIDI file Blob.
 */
export function createMidiFile(
  notes: RollNote[],
  trackName: string = "MuScriptor Track",
  bpm: number = 120,
): Blob {
  const ppq = 480; // Ticks per quarter note
  const secondsPerBeat = 60 / bpm;
  const ticksPerSecond = ppq / secondsPerBeat;

  type Event = {
    tick: number;
    type: "on" | "off";
    pitch: number;
    velocity: number;
  };

  const events: Event[] = [];

  for (const note of notes) {
    const startTick = Math.max(0, Math.round(note.start * ticksPerSecond));
    const endTick = Math.max(startTick + 1, Math.round(note.end * ticksPerSecond));
    events.push({ tick: startTick, type: "on", pitch: note.pitch, velocity: 100 });
    events.push({ tick: endTick, type: "off", pitch: note.pitch, velocity: 0 });
  }

  // Sort events chronologically. If ticks are equal, Note Off comes before Note On.
  events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (a.type === b.type) return 0;
    return a.type === "off" ? -1 : 1;
  });

  const trackBytes: number[] = [];

  // Tempo meta-event: 120 BPM = 500,000 microseconds per beat
  const microsecondsPerBeat = Math.round(60_000_000 / bpm);
  trackBytes.push(
    0x00,
    0xff,
    0x51,
    0x03,
    (microsecondsPerBeat >> 16) & 0xff,
    (microsecondsPerBeat >> 8) & 0xff,
    microsecondsPerBeat & 0xff,
  );

  // Track Name meta-event
  const nameBytes = new TextEncoder().encode(trackName);
  trackBytes.push(0x00, 0xff, 0x03, ...encodeVLQ(nameBytes.length), ...Array.from(nameBytes));

  let lastTick = 0;
  for (const ev of events) {
    const delta = ev.tick - lastTick;
    lastTick = ev.tick;
    trackBytes.push(...encodeVLQ(delta));

    const status = ev.type === "on" ? 0x90 : 0x80;
    const pitch = Math.max(0, Math.min(127, Math.round(ev.pitch)));
    trackBytes.push(status, pitch, ev.velocity);
  }

  // End of Track meta-event
  trackBytes.push(0x00, 0xff, 0x2f, 0x00);

  // MThd header: 14 bytes
  const header = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // length 6
    0x00, 0x00, // type 0
    0x00, 0x01, // 1 track
    (ppq >> 8) & 0xff, ppq & 0xff, // PPQ
  ];

  // MTrk header: 4 bytes identifier + 4 bytes length
  const trackLen = trackBytes.length;
  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    (trackLen >> 24) & 0xff,
    (trackLen >> 16) & 0xff,
    (trackLen >> 8) & 0xff,
    trackLen & 0xff,
  ];

  const fullFile = new Uint8Array([...header, ...trackHeader, ...trackBytes]);
  return new Blob([fullFile], { type: "audio/midi" });
}
