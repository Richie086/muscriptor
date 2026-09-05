"""Rhythm accompaniment generator for rock drum beats and metronome click tracks.

Generates synchronized percussion tracks (General MIDI Channel 10) aligned with
the song's detected BeatGrid or an estimated tempo.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

import numpy as np

from muscriptor.tokenizer.notes import (
    DRUM_PROGRAM,
    MINIMUM_NOTE_DURATION_SEC,
    Note,
)
from muscriptor.utils.beats import BeatGrid

# General MIDI Drum Note Numbers
KICK_DRUM = 36  # Bass Drum 1
SNARE_DRUM = 38  # Acoustic Snare
CLOSED_HI_HAT = 42  # Closed Hi-Hat
HIGH_WOODBLOCK = 76  # Metronome primary downbeat accent
LOW_WOODBLOCK = 77  # Metronome regular beat pulse

DrumStyle = Literal["rock", "click"]


def estimate_bpm_from_onsets(
    onsets: Sequence[float],
    min_bpm: float = 60.0,
    max_bpm: float = 200.0,
    default_bpm: float = 120.0,
) -> float:
    """Estimate a song's BPM from a sequence of note onset timestamps.

    Uses inter-onset intervals (IOIs) and histogram clustering within the
    valid tempo range [min_bpm, max_bpm]. Falls back to `default_bpm` if
    insufficient onsets are provided.
    """
    if len(onsets) < 4:
        return default_bpm

    times = np.sort(np.unique(np.round(np.asarray(onsets, dtype=float), 3)))
    iois = np.diff(times)

    # Convert tempo range to interval range in seconds
    min_interval = 60.0 / max_bpm
    max_interval = 60.0 / min_bpm

    valid_iois = iois[(iois >= min_interval * 0.5) & (iois <= max_interval * 2.0)]
    if len(valid_iois) < 3:
        return default_bpm

    # Fold harmonic multiples/submultiples (e.g. eighth notes, half notes) into beat interval
    normalized_intervals = []
    for dt in valid_iois:
        # Scale into [min_interval, max_interval]
        interval = dt
        while interval < min_interval:
            interval *= 2.0
        while interval > max_interval:
            interval /= 2.0
        if min_interval <= interval <= max_interval:
            normalized_intervals.append(interval)

    if not normalized_intervals:
        return default_bpm

    median_interval = float(np.median(normalized_intervals))
    bpm = 60.0 / median_interval
    return round(float(np.clip(bpm, min_bpm, max_bpm)), 1)


def generate_rock_beat(
    beat_grid: BeatGrid | None = None,
    total_duration: float = 0.0,
    style: DrumStyle = "rock",
    bpm: float = 120.0,
    beats_per_bar: int = 4,
    start_time: float = 0.0,
) -> list[Note]:
    """Generate a synchronized percussion track as a list of Note objects.

    Args:
        beat_grid: Optional detected BeatGrid. If provided, its bpm, beats_per_bar,
            and first_downbeat are used.
        total_duration: Total duration of the track in seconds.
        style: 'rock' for kick/snare/hi-hat groove, 'click' for metronome woodblock.
        bpm: Fallback BPM if beat_grid is None.
        beats_per_bar: Fallback meter (beats per measure) if beat_grid is None.
        start_time: Starting offset in seconds (defaults to 0.0).

    Returns:
        List of Note instances with is_drum=True and program=DRUM_PROGRAM.
    """
    if beat_grid is not None:
        grid_bpm = beat_grid.bpm if beat_grid.bpm and beat_grid.bpm > 0 else bpm
        grid_meter = beat_grid.beats_per_bar if beat_grid.beats_per_bar else beats_per_bar
        first_downbeat = beat_grid.first_downbeat
    else:
        grid_bpm = bpm
        grid_meter = beats_per_bar
        first_downbeat = start_time

    if total_duration <= 0.0:
        return []

    beat_duration = 60.0 / grid_bpm
    bar_duration = grid_meter * beat_duration

    # Determine measure boundary alignment
    # Align bars so that first_downbeat falls on beat 0 of a measure
    offset = first_downbeat % bar_duration
    start_measure = int(np.floor((start_time - offset) / bar_duration))
    end_measure = int(np.ceil((total_duration - offset) / bar_duration)) + 1

    notes: list[Note] = []

    for m in range(start_measure, end_measure):
        bar_start = offset + m * bar_duration

        if style == "click":
            # Metronome: High Woodblock on beat 1, Low Woodblock on subsequent beats
            for b in range(grid_meter):
                t = bar_start + b * beat_duration
                if start_time <= t < total_duration:
                    pitch = HIGH_WOODBLOCK if b == 0 else LOW_WOODBLOCK
                    notes.append(
                        Note(
                            is_drum=True,
                            program=DRUM_PROGRAM,
                            onset=round(t, 4),
                            offset=round(t + MINIMUM_NOTE_DURATION_SEC, 4),
                            pitch=pitch,
                        )
                    )

        elif style == "rock":
            # Standard Rock Groove
            # Hi-Hat: 8th note subdivisions (2 hits per beat)
            for b in range(grid_meter):
                # On-beat hi-hat
                t_on = bar_start + b * beat_duration
                if start_time <= t_on < total_duration:
                    notes.append(
                        Note(
                            is_drum=True,
                            program=DRUM_PROGRAM,
                            onset=round(t_on, 4),
                            offset=round(t_on + MINIMUM_NOTE_DURATION_SEC, 4),
                            pitch=CLOSED_HI_HAT,
                        )
                    )
                # Off-beat 8th note hi-hat
                t_off = bar_start + (b + 0.5) * beat_duration
                if start_time <= t_off < total_duration:
                    notes.append(
                        Note(
                            is_drum=True,
                            program=DRUM_PROGRAM,
                            onset=round(t_off, 4),
                            offset=round(t_off + MINIMUM_NOTE_DURATION_SEC, 4),
                            pitch=CLOSED_HI_HAT,
                        )
                    )

            if grid_meter == 3:
                # 3/4 meter: Kick on Beat 1, Snare on Beats 2 & 3
                t_b1 = bar_start
                if start_time <= t_b1 < total_duration:
                    notes.append(
                        Note(
                            is_drum=True,
                            program=DRUM_PROGRAM,
                            onset=round(t_b1, 4),
                            offset=round(t_b1 + MINIMUM_NOTE_DURATION_SEC, 4),
                            pitch=KICK_DRUM,
                        )
                    )
                for b in (1, 2):
                    t_sn = bar_start + b * beat_duration
                    if start_time <= t_sn < total_duration:
                        notes.append(
                            Note(
                                is_drum=True,
                                program=DRUM_PROGRAM,
                                onset=round(t_sn, 4),
                                offset=round(t_sn + MINIMUM_NOTE_DURATION_SEC, 4),
                                pitch=SNARE_DRUM,
                            )
                        )
            else:
                # 4/4 (or standard even meter):
                # Kick on Beats 1 and 3 (index 0 and 2)
                # Snare on Beats 2 and 4 (index 1 and 3)
                for b in range(grid_meter):
                    t_beat = bar_start + b * beat_duration
                    if not (start_time <= t_beat < total_duration):
                        continue

                    if b % 2 == 0:
                        # Downbeat / Midpoint kick
                        notes.append(
                            Note(
                                is_drum=True,
                                program=DRUM_PROGRAM,
                                onset=round(t_beat, 4),
                                offset=round(t_beat + MINIMUM_NOTE_DURATION_SEC, 4),
                                pitch=KICK_DRUM,
                            )
                        )
                    else:
                        # Backbeat snare
                        notes.append(
                            Note(
                                is_drum=True,
                                program=DRUM_PROGRAM,
                                onset=round(t_beat, 4),
                                offset=round(t_beat + MINIMUM_NOTE_DURATION_SEC, 4),
                                pitch=SNARE_DRUM,
                            )
                        )

    # Sort notes chronologically
    notes.sort(key=lambda n: (n.onset, n.pitch))
    return notes
