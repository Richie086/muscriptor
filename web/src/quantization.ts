import type { RollNote } from "./pianoroll";

export type GridDivision =
  | "off"
  | "1/4"
  | "1/8"
  | "1/16"
  | "1/32"
  | "1/8t"
  | "1/16t";

export function getGridInterval(division: GridDivision, bpm: number = 120): number {
  if (division === "off" || bpm <= 0) return 0;
  const quarter = 60 / bpm;
  switch (division) {
    case "1/4":
      return quarter;
    case "1/8":
      return quarter / 2;
    case "1/16":
      return quarter / 4;
    case "1/32":
      return quarter / 8;
    case "1/8t":
      return quarter / 3;
    case "1/16t":
      return quarter / 6;
    default:
      return 0;
  }
}

export function snapTime(timeSec: number, stepSec: number): number {
  if (stepSec <= 0) return timeSec;
  return Math.max(0, Math.round(timeSec / stepSec) * stepSec);
}

export function quantizeNotes(notes: RollNote[], stepSec: number): RollNote[] {
  if (stepSec <= 0) return notes;
  return notes.map((n) => {
    const newStart = snapTime(n.start, stepSec);
    const snappedEnd = snapTime(n.end, stepSec);
    const minEnd = newStart + 0.05;
    const newEnd = Math.max(minEnd, snappedEnd);
    return {
      ...n,
      start: newStart,
      end: newEnd,
    };
  });
}
