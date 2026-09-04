"""Tests for guitar tab & chord transcription module (muscriptor.utils.tabs)."""

import io
import pytest
from fastapi.testclient import TestClient

from muscriptor.tokenizer.notes import Note
from muscriptor.utils.beats import BeatGrid
from muscriptor.utils.tabs import (
    detect_chord_name,
    generate_tab_and_chord_transcription,
    pitch_to_fret,
)


def test_detect_chord_name():
    # C major (C4, E4, G4 -> 60, 64, 67)
    assert detect_chord_name([60, 64, 67]) == "C"

    # A minor (A3, C4, E4 -> 57, 60, 64)
    assert detect_chord_name([57, 60, 64]) == "Am"

    # G7 (G3, B3, D4, F4 -> 55, 59, 62, 65)
    assert detect_chord_name([55, 59, 62, 65]) == "G7"

    # Single pitch
    assert detect_chord_name([60]) == "C"

    # Empty pitches
    assert detect_chord_name([]) == ""


def test_pitch_to_fret():
    # E2 (MIDI 40) -> Low E string (string 6), fret 0
    assert pitch_to_fret(40) == (6, 0)

    # A2 (MIDI 45) -> A string (string 5), fret 0
    assert pitch_to_fret(45) == (5, 0)

    # C4 (MIDI 60) -> B string (string 2), fret 1
    assert pitch_to_fret(60) == (2, 1)


def test_generate_tab_and_chord_transcription():
    notes = [
        Note(is_drum=False, program=24, onset=0.0, offset=0.5, pitch=60),  # C4
        Note(is_drum=False, program=24, onset=0.0, offset=0.5, pitch=64),  # E4
        Note(is_drum=False, program=24, onset=0.0, offset=0.5, pitch=67),  # G4
    ]
    beat_grid = BeatGrid(bpm=120.0, beats_per_bar=4, first_downbeat=0.0)

    output = generate_tab_and_chord_transcription(notes, beat_grid=beat_grid)

    assert "MUSCRIPTOR - GUITAR TAB & CHORD TRANSCRIPTION" in output
    assert "Chord: C" in output
    assert "e |" in output
    assert "E |" in output


def test_server_tabs_endpoint(monkeypatch):
    from muscriptor.server import create_app
    from muscriptor.utils.midi import notes_to_midi
    from unittest.mock import MagicMock

    mock_model = MagicMock()
    app = create_app(mock_model)
    client = TestClient(app)

    test_notes = [
        Note(is_drum=False, program=24, onset=0.0, offset=0.5, pitch=60),
        Note(is_drum=False, program=24, onset=0.0, offset=0.5, pitch=64),
        Note(is_drum=False, program=24, onset=0.0, offset=0.5, pitch=67),
    ]
    midi_file = notes_to_midi(test_notes)
    buf = io.BytesIO()
    midi_file.save(file=buf)
    fake_midi = buf.getvalue()

    resp = client.post("/tabs", files={"midi": ("test.mid", fake_midi, "audio/midi")})
    assert resp.status_code == 200




    assert "attachment; filename=\"guitar_tabs_chords.txt\"" in resp.headers["content-disposition"]
    assert "MUSCRIPTOR - GUITAR TAB & CHORD TRANSCRIPTION" in resp.text
    assert "Chord: C" in resp.text

