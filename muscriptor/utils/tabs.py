"""Guitar Tablature and Chord Transcriber module.

Converts MIDI notes or pitch events into:
1. Identified chord names (Root + quality, e.g. C, Am, G7, Fmaj7, Dm)
2. ASCII 6-string guitar tablature with measure bars and chord indicators.
"""

from collections import defaultdict
from dataclasses import dataclass
from typing import Sequence

from muscriptor.tokenizer.notes import Note
from muscriptor.utils.beats import BeatGrid
from muscriptor.utils.midi import PLACEHOLDER_GRID


# Standard Guitar Tuning: String 6 to String 1
# String 6 = E2 (MIDI 40)
# String 5 = A2 (MIDI 45)
# String 4 = D3 (MIDI 50)
# String 3 = G3 (MIDI 55)
# String 2 = B3 (MIDI 59)
# String 1 = E4 (MIDI 64)
STANDARD_TUNING = [
    (6, 40, "E"),
    (5, 45, "A"),
    (4, 50, "D"),
    (3, 55, "G"),
    (2, 59, "B"),
    (1, 64, "e"),
]

PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Interval set relative to root -> chord suffix
CHORD_TEMPLATES = [
    ({0, 4, 7}, ""),           # Major
    ({0, 3, 7}, "m"),          # Minor
    ({0, 4, 7, 10}, "7"),      # Dominant 7th
    ({0, 4, 7, 11}, "maj7"),   # Major 7th
    ({0, 3, 7, 10}, "m7"),     # Minor 7th
    ({0, 5, 7}, "sus4"),       # Sus4
    ({0, 2, 7}, "sus2"),       # Sus2
    ({0, 3, 6}, "dim"),        # Diminished
    ({0, 4, 8}, "aug"),        # Augmented
    ({0, 7}, "5"),             # Power chord
]


def detect_chord_name(pitches: Sequence[int]) -> str:
    """Identify the chord name for a given list of MIDI pitches.

    Returns root note + chord quality (e.g., 'C', 'Am', 'G7', 'Fmaj7')
    or empty string if no pitches provided.
    """
    if not pitches:
        return ""

    unique_pcs = sorted(set(p % 12 for p in pitches))
    if len(unique_pcs) == 1:
        return PITCH_NAMES[unique_pcs[0]]

    # Try each pitch class as potential root
    best_match = None
    best_score = -1

    for root_pc in unique_pcs:
        # Calculate intervals relative to this root
        intervals = set((pc - root_pc) % 12 for pc in unique_pcs)
        for template_intervals, suffix in CHORD_TEMPLATES:
            # Check how many template intervals are covered
            match_count = len(template_intervals.intersection(intervals))
            extra_count = len(intervals - template_intervals)
            score = match_count * 10 - extra_count * 2
            if match_count == len(template_intervals) and score > best_score:
                best_score = score
                best_match = f"{PITCH_NAMES[root_pc]}{suffix}"

    if best_match:
        return best_match

    # Fallback to lowest note or root
    lowest_pc = min(pitches) % 12
    return PITCH_NAMES[lowest_pc]


def pitch_to_fret(pitch: int) -> tuple[int, int] | None:
    """Map a MIDI pitch to optimal (string_num, fret_num) on standard 6-string guitar.

    string_num: 1 (high E) to 6 (low E).
    fret_num: 0 to 19.
    """
    candidates = []
    for string_num, base_pitch, _ in STANDARD_TUNING:
        fret = pitch - base_pitch
        if 0 <= fret <= 19:
            candidates.append((string_num, fret))

    if not candidates:
        return None

    # Prefer lower frets (closer to nut 0-5)
    candidates.sort(key=lambda sf: (sf[1], sf[0]))
    return candidates[0]


def generate_tab_and_chord_transcription(
    notes: list[Note],
    beat_grid: BeatGrid | None = None,
) -> str:
    """Generate clean ASCII 6-string guitar tablature & chord chart text."""
    if not notes:
        return "No notes found in transcription.\n"

    beat_grid = beat_grid or PLACEHOLDER_GRID
    bpm = beat_grid.bpm or 120.0
    beats_per_bar = beat_grid.beats_per_bar or 4
    bar_duration = (60.0 / bpm) * beats_per_bar

    non_drum_notes = [n for n in notes if not n.is_drum]
    if not non_drum_notes:
        non_drum_notes = notes

    max_time = max(n.offset for n in non_drum_notes)
    num_bars = max(1, int(max_time / bar_duration) + 1)

    # Group notes by bar
    bars_notes: list[list[Note]] = [[] for _ in range(num_bars)]
    for n in non_drum_notes:
        bar_idx = min(int(n.onset / bar_duration), num_bars - 1)
        bars_notes[bar_idx].append(n)

    lines = []
    lines.append("==========================================================")
    lines.append("        MUSCRIPTOR - GUITAR TAB & CHORD TRANSCRIPTION     ")
    lines.append(f" Tempo: {round(bpm)} BPM | Time Signature: {beats_per_bar}/4")
    lines.append("==========================================================\n")

    for bar_idx, b_notes in enumerate(bars_notes):
        bar_num = bar_idx + 1
        b_pitches = [n.pitch for n in b_notes]
        chord_name = detect_chord_name(b_pitches) if b_pitches else "N.C."

        lines.append(f"--- Bar {bar_num}  [ Chord: {chord_name} ] ---")

        # Initialize 6 tab string buffers
        # 1: e, 2: B, 3: G, 4: D, 5: A, 6: E
        string_labels = ["e", "B", "G", "D", "A", "E"]
        tab_buffers = {label: ["|"] for label in string_labels}

        if not b_notes:
            for label in string_labels:
                tab_buffers[label].append("--------------------|")
        else:
            # Subdivide bar into 16 steps
            steps = 16
            bar_start = bar_idx * bar_duration
            step_duration = bar_duration / steps

            step_notes: list[list[Note]] = [[] for _ in range(steps)]
            for n in b_notes:
                rel_onset = n.onset - bar_start
                s_idx = max(0, min(int(rel_onset / step_duration), steps - 1))
                step_notes[s_idx].append(n)

            for s_idx in range(steps):
                snotes = step_notes[s_idx]
                step_frets: dict[str, str] = {lbl: "-" for lbl in string_labels}

                for n in snotes:
                    res = pitch_to_fret(n.pitch)
                    if res:
                        string_num, fret = res
                        lbl = string_labels[6 - string_num]
                        step_frets[lbl] = str(fret)

                for lbl in string_labels:
                    tab_buffers[lbl].append(step_frets[lbl])

            for lbl in string_labels:
                tab_buffers[lbl].append("|")

        for lbl in string_labels:
            lines.append(f"{lbl} " + "".join(tab_buffers[lbl]))
        lines.append("")

    return "\n".join(lines) + "\n"
