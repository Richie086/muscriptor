import type { BeatGrid, RollNote } from "./pianoroll";

export const KICK_DRUM = 36;
export const SNARE_DRUM = 38;
export const CLOSED_HI_HAT = 42;
export const HIGH_WOODBLOCK = 76;
export const LOW_WOODBLOCK = 77;

export type AccompanimentStyle = "off" | "rock" | "click";

/**
 * Generate synchronized percussion notes (General MIDI Channel 10)
 * aligned with the detected BeatGrid or fallback 120 BPM 4/4 meter.
 */
export function generateDrumTrack(
  beatGrid: BeatGrid | null,
  duration: number,
  style: "rock" | "click",
  fallbackBpm: number = 120,
  fallbackMeter: number = 4,
): RollNote[] {
  if (duration <= 0) return [];

  const bpm = beatGrid?.bpm && beatGrid.bpm > 0 ? beatGrid.bpm : fallbackBpm;
  const meter = beatGrid?.beats_per_bar && beatGrid.beats_per_bar > 0 ? beatGrid.beats_per_bar : fallbackMeter;
  const firstDownbeat = beatGrid?.first_downbeat ?? 0;

  const beatSec = 60 / bpm;
  const barSec = meter * beatSec;

  const offset = ((firstDownbeat % barSec) + barSec) % barSec;
  const startMeasure = Math.floor(-offset / barSec);
  const endMeasure = Math.ceil((duration - offset) / barSec) + 1;

  const notes: RollNote[] = [];
  const hitDuration = 0.05;

  for (let m = startMeasure; m < endMeasure; m++) {
    const barStart = offset + m * barSec;

    if (style === "click") {
      for (let b = 0; b < meter; b++) {
        const t = barStart + b * beatSec;
        if (t >= 0 && t < duration) {
          notes.push({
            pitch: b === 0 ? HIGH_WOODBLOCK : LOW_WOODBLOCK,
            start: t,
            end: t + hitDuration,
            instrument: "drums",
          });
        }
      }
    } else if (style === "rock") {
      // 8th-note Hi-Hats
      for (let b = 0; b < meter; b++) {
        const tOn = barStart + b * beatSec;
        if (tOn >= 0 && tOn < duration) {
          notes.push({
            pitch: CLOSED_HI_HAT,
            start: tOn,
            end: tOn + hitDuration,
            instrument: "drums",
          });
        }
        const tOff = barStart + (b + 0.5) * beatSec;
        if (tOff >= 0 && tOff < duration) {
          notes.push({
            pitch: CLOSED_HI_HAT,
            start: tOff,
            end: tOff + hitDuration,
            instrument: "drums",
          });
        }
      }

      if (meter === 3) {
        // 3/4 time: Kick on 1, Snare on 2 & 3
        const tKick = barStart;
        if (tKick >= 0 && tKick < duration) {
          notes.push({
            pitch: KICK_DRUM,
            start: tKick,
            end: tKick + hitDuration,
            instrument: "drums",
          });
        }
        for (const b of [1, 2]) {
          const tSnare = barStart + b * beatSec;
          if (tSnare >= 0 && tSnare < duration) {
            notes.push({
              pitch: SNARE_DRUM,
              start: tSnare,
              end: tSnare + hitDuration,
              instrument: "drums",
            });
          }
        }
      } else {
        // 4/4 or even meters:
        // Kick on beats 1 & 3 (index 0 and 2)
        // Snare on beats 2 & 4 (index 1 and 3)
        for (let b = 0; b < meter; b++) {
          const t = barStart + b * beatSec;
          if (t >= 0 && t < duration) {
            const pitch = b % 2 === 0 ? KICK_DRUM : SNARE_DRUM;
            notes.push({
              pitch,
              start: t,
              end: t + hitDuration,
              instrument: "drums",
            });
          }
        }
      }
    }
  }

  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  return notes;
}
