import type { RollNote } from "./pianoroll";

export interface DetectedChord {
  name: string;
  root: string;
  quality: string;
  bass?: string;
  notes: string[];
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function pitchToNoteName(pitch: number): string {
  const pc = ((pitch % 12) + 12) % 12;
  return NOTE_NAMES[pc];
}

interface ChordPattern {
  quality: string;
  intervals: number[]; // Set of pitch class offsets relative to root
  score: number;       // Priority weight for matching
}

const CHORD_PATTERNS: ChordPattern[] = [
  // 7ths & Extended
  { quality: "maj7", intervals: [0, 4, 7, 11], score: 10 },
  { quality: "m7", intervals: [0, 3, 7, 10], score: 10 },
  { quality: "7", intervals: [0, 4, 7, 10], score: 10 },
  { quality: "dim7", intervals: [0, 3, 6, 9], score: 10 },
  { quality: "m7b5", intervals: [0, 3, 6, 10], score: 10 },
  { quality: "7sus4", intervals: [0, 5, 7, 10], score: 9 },
  { quality: "6", intervals: [0, 4, 7, 9], score: 9 },
  { quality: "m6", intervals: [0, 3, 7, 9], score: 9 },
  { quality: "add9", intervals: [0, 2, 4, 7], score: 9 },
  
  // Triads
  { quality: "", intervals: [0, 4, 7], score: 8 },      // Major (e.g. "C")
  { quality: "m", intervals: [0, 3, 7], score: 8 },     // Minor (e.g. "Am")
  { quality: "dim", intervals: [0, 3, 6], score: 8 },   // Diminished
  { quality: "aug", intervals: [0, 4, 8], score: 8 },   // Augmented
  { quality: "sus4", intervals: [0, 5, 7], score: 7 }, // Sus4
  { quality: "sus2", intervals: [0, 2, 7], score: 7 }, // Sus2

  // Dyads & Power Chords
  { quality: "5", intervals: [0, 7], score: 5 },        // Power chord
];

/**
 * Approximate the active musical chord at a given timestamp in seconds.
 */
export function detectChordAtTime(
  notes: RollNote[],
  timeSeconds: number,
  hiddenInstruments?: Set<string>,
): DetectedChord {
  // Find active notes around the target playhead time (with +/- 0.08s tolerance for onset alignment)
  const active = notes.filter((n) => {
    if (hiddenInstruments && hiddenInstruments.has(n.instrument)) return false;
    return n.start <= timeSeconds + 0.08 && n.end >= timeSeconds - 0.08;
  });

  if (active.length === 0) {
    return { name: "N.C.", root: "", quality: "", notes: [] };
  }

  // Sort notes by pitch ascending
  const sorted = [...active].sort((a, b) => a.pitch - b.pitch);
  const activePitches = Array.from(new Set(sorted.map((n) => n.pitch)));
  const pitchNames = activePitches.map((p) => `${pitchToNoteName(p)}${Math.floor(p / 12) - 1}`);
  const uniquePCs = Array.from(new Set(activePitches.map((p) => ((p % 12) + 12) % 12)));

  const bassPC = ((sorted[0].pitch % 12) + 12) % 12;
  const bassNoteName = NOTE_NAMES[bassPC];

  // If only 1 pitch class, return single note
  if (uniquePCs.length === 1) {
    return {
      name: NOTE_NAMES[uniquePCs[0]],
      root: NOTE_NAMES[uniquePCs[0]],
      quality: "",
      notes: pitchNames,
    };
  }

  // Evaluate candidate roots from present pitch classes
  let bestMatch: { rootPC: number; quality: string; score: number; matchedCount: number } | null = null;

  for (const rootPC of uniquePCs) {
    // Relative intervals from candidate root
    const intervalsPresent = new Set(uniquePCs.map((pc) => ((pc - rootPC) % 12 + 12) % 12));

    for (const pattern of CHORD_PATTERNS) {
      const matchIntervals = pattern.intervals;
      const hasAllIntervals = matchIntervals.every((i) => intervalsPresent.has(i));

      if (hasAllIntervals) {
        // Preference bonus if root matches bass pitch
        const isBassRoot = rootPC === bassPC ? 3 : 0;
        const score = pattern.score * 10 + matchIntervals.length * 2 + isBassRoot;

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            rootPC,
            quality: pattern.quality,
            score,
            matchedCount: matchIntervals.length,
          };
        }
      }
    }
  }

  if (bestMatch) {
    const rootName = NOTE_NAMES[bestMatch.rootPC];
    let chordName = `${rootName}${bestMatch.quality}`;
    
    // Add slash chord notation if bass note is distinct from root
    if (bassPC !== bestMatch.rootPC && uniquePCs.length >= 3) {
      chordName += `/${bassNoteName}`;
    }

    return {
      name: chordName,
      root: rootName,
      quality: bestMatch.quality,
      bass: bassPC !== bestMatch.rootPC ? bassNoteName : undefined,
      notes: pitchNames,
    };
  }

  // Fallback: If 2 notes form an unknown interval, output dyad note names (e.g., "C+E")
  if (uniquePCs.length === 2) {
    const n1 = NOTE_NAMES[uniquePCs[0]];
    const n2 = NOTE_NAMES[uniquePCs[1]];
    return {
      name: `${n1} / ${n2}`,
      root: n1,
      quality: "dyad",
      notes: pitchNames,
    };
  }

  // Generic fallback: Bass root + 'chord'
  return {
    name: `${bassNoteName} chord`,
    root: bassNoteName,
    quality: "",
    notes: pitchNames,
  };
}
