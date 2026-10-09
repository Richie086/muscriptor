"""Tests for muscriptor/utils/drums.py."""

import pytest
import numpy as np

from muscriptor.tokenizer.notes import DRUM_PROGRAM, note_event2midi, note2note_event
from muscriptor.utils.beats import BeatGrid
from muscriptor.utils.drums import (
    CLOSED_HI_HAT,
    HIGH_WOODBLOCK,
    KICK_DRUM,
    LOW_WOODBLOCK,
    SNARE_DRUM,
    estimate_bpm_from_onsets,
    generate_rock_beat,
)


def test_estimate_bpm_from_onsets():
    # 120 BPM = 0.5s intervals
    beats_120 = [i * 0.5 for i in range(20)]
    bpm = estimate_bpm_from_onsets(beats_120)
    assert bpm == pytest.approx(120.0, abs=1.0)

    # 100 BPM = 0.6s intervals
    beats_100 = [i * 0.6 for i in range(20)]
    bpm_100 = estimate_bpm_from_onsets(beats_100)
    assert bpm_100 == pytest.approx(100.0, abs=1.0)

    # Insufficient onsets falls back to default
    assert estimate_bpm_from_onsets([0.0, 0.5]) == 120.0


def test_generate_rock_beat_4_4():
    # 120 BPM: beat is 0.5s, 4/4 measure is 2.0s
    # 2 measures = 4.0s
    notes = generate_rock_beat(
        beat_grid=None,
        total_duration=4.0,
        style="rock",
        bpm=120.0,
        beats_per_bar=4,
        start_time=0.0,
    )

    assert len(notes) > 0
    # Every note should be flagged as drum with DRUM_PROGRAM
    for n in notes:
        assert n.is_drum is True
        assert n.program == DRUM_PROGRAM

    # Extract notes by pitch
    kicks = [n for n in notes if n.pitch == KICK_DRUM]
    snares = [n for n in notes if n.pitch == SNARE_DRUM]
    hihats = [n for n in notes if n.pitch == CLOSED_HI_HAT]

    # In 2 bars of 4/4 at 120 BPM:
    # Kicks on beats 1 & 3:
    # Bar 1: t = 0.0s (b0), t = 1.0s (b2)
    # Bar 2: t = 2.0s (b0), t = 3.0s (b2)
    assert len(kicks) == 4
    kick_times = [k.onset for k in kicks]
    assert kick_times == [0.0, 1.0, 2.0, 3.0]

    # Snares on beats 2 & 4:
    # Bar 1: t = 0.5s (b1), t = 1.5s (b3)
    # Bar 2: t = 2.5s (b1), t = 3.5s (b3)
    assert len(snares) == 4
    snare_times = [s.onset for s in snares]
    assert snare_times == [0.5, 1.5, 2.5, 3.5]

    # Hi-hats on every 8th note (every 0.25s): 16 hits across 4.0s
    assert len(hihats) == 16
    assert hihats[0].onset == 0.0
    assert hihats[1].onset == 0.25
    assert hihats[-1].onset == 3.75


def test_generate_rock_beat_3_4():
    # 120 BPM: beat is 0.5s, 3/4 measure is 1.5s
    # 2 measures = 3.0s
    notes = generate_rock_beat(
        beat_grid=None,
        total_duration=3.0,
        style="rock",
        bpm=120.0,
        beats_per_bar=3,
        start_time=0.0,
    )

    kicks = [n for n in notes if n.pitch == KICK_DRUM]
    snares = [n for n in notes if n.pitch == SNARE_DRUM]

    # In 3/4: Kick on beat 1 (0.0s, 1.5s), Snare on beats 2 & 3 (0.5s, 1.0s, 2.0s, 2.5s)
    assert len(kicks) == 2
    assert [k.onset for k in kicks] == [0.0, 1.5]

    assert len(snares) == 4
    assert [s.onset for s in snares] == [0.5, 1.0, 2.0, 2.5]


def test_generate_click_track():
    # Metronome click: High woodblock on beat 1, Low woodblock on other beats
    notes = generate_rock_beat(
        beat_grid=None,
        total_duration=4.0,
        style="click",
        bpm=120.0,
        beats_per_bar=4,
        start_time=0.0,
    )

    high_clicks = [n for n in notes if n.pitch == HIGH_WOODBLOCK]
    low_clicks = [n for n in notes if n.pitch == LOW_WOODBLOCK]

    # 2 bars: downbeats at t=0.0 and t=2.0
    assert len(high_clicks) == 2
    assert [c.onset for c in high_clicks] == [0.0, 2.0]

    # Other beats: 3 per bar = 6 clicks
    assert len(low_clicks) == 6
    assert [c.onset for c in low_clicks] == [0.5, 1.0, 1.5, 2.5, 3.0, 3.5]


def test_generate_with_beat_grid():
    grid = BeatGrid(
        bpm=100.0,
        beats_per_bar=4,
        first_downbeat=0.2,
        beats=np.arange(0.2, 10.0, 0.6),
    )

    notes = generate_rock_beat(
        beat_grid=grid,
        total_duration=5.0,
        style="rock",
    )

    assert len(notes) > 0
    kicks = [n for n in notes if n.pitch == KICK_DRUM]
    # First downbeat is at 0.2s
    assert kicks[0].onset == 0.2


def test_drum_notes_to_midi():
    notes = generate_rock_beat(
        total_duration=2.0,
        style="rock",
        bpm=120.0,
        beats_per_bar=4,
    )

    events = note2note_event(notes)
    midi = note_event2midi(events, program_names={DRUM_PROGRAM: "drums"})

    # Verify MIDI contains a track for drums with channel 9 (GM channel 10)
    drum_track = None
    for track in midi.tracks:
        for msg in track:
            if msg.type == "track_name" and msg.name == "drums":
                drum_track = track
                break

    assert drum_track is not None
    # Check that note_on messages use channel 9
    note_msgs = [msg for msg in drum_track if msg.type == "note_on"]
    assert len(note_msgs) > 0
    for msg in note_msgs:
        assert msg.channel == 9


def test_notes_to_midi_with_drum_accompaniment():
    from muscriptor.tokenizer.notes import Note
    from muscriptor.utils.midi import notes_to_midi

    # Sample melodic notes (e.g. piano)
    notes = [
        Note(is_drum=False, program=0, onset=0.0, offset=1.0, pitch=60),
        Note(is_drum=False, program=0, onset=1.0, offset=2.0, pitch=64),
    ]

    midi = notes_to_midi(notes, drum_accompaniment="rock")
    # Must contain meta track, piano track, and drums track
    track_names = []
    for track in midi.tracks:
        for msg in track:
            if msg.type == "track_name":
                track_names.append(msg.name)

    assert "drums" in track_names

