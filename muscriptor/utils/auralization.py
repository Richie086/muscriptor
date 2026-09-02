"""FluidSynth-based MIDI auralization (with pure-Python fallback).

Synthesizes a MIDI file with FluidSynth (or built-in Python synth fallback)
and blends the result with the original audio into a stereo mix (L = original, R = synthesis).
"""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from mido import MidiFile

from muscriptor.soundfonts import SF2_URL
from muscriptor.utils.audio import load_audio
from muscriptor.utils.beats import read_bar_offset
from muscriptor.utils.download import download_if_necessary

_LOCAL_SOUNDFONT = Path(__file__).parent.parent.parent / "MuseScore_General.sf2"
_SAMPLE_RATE = 44100


def _load_mono_44k(path: Path) -> np.ndarray:
    """Return a mono float32 numpy array at 44100 Hz for any audio file."""
    wav = load_audio(str(path), target_sr=_SAMPLE_RATE)  # [1, T]
    return wav[0].numpy()


def _resolve_soundfont(soundfont_path: str | Path | None) -> Path:
    if soundfont_path is None:
        if _LOCAL_SOUNDFONT.exists():
            return _LOCAL_SOUNDFONT
        return download_if_necessary(SF2_URL)
    soundfont_path = Path(soundfont_path)
    if not soundfont_path.exists():
        raise FileNotFoundError(
            f"SoundFont not found: {soundfont_path}\n"
            "Pass --soundfont /path/to/file.sf2, or omit it to use "
            "MuseScore_General.sf2 (downloaded once and cached)."
        )
    return soundfont_path


def _pure_python_synth_midi(midi_path: Path, sample_rate: int = _SAMPLE_RATE) -> np.ndarray:
    """Fallback pure-Python additive synthesis when fluidsynth binary is not installed."""
    try:
        midi = MidiFile(str(midi_path))
    except Exception:
        return np.zeros(sample_rate, dtype=np.float32)

    ticks_per_beat = midi.ticks_per_beat or 480
    tempo = 500000  # default 120 bpm (500,000 us/beat)

    events = []
    for track in midi.tracks:
        abs_time_s = 0.0
        active_notes: dict[int, tuple[float, int]] = {}
        for msg in track:
            if msg.type == "set_tempo":
                tempo = msg.tempo
            
            delta_s = (msg.time / ticks_per_beat) * (tempo / 1_000_000.0)
            abs_time_s += delta_s

            if msg.type == "note_on" and msg.velocity > 0:
                active_notes[msg.note] = (abs_time_s, msg.velocity)
            elif (msg.type == "note_off") or (msg.type == "note_on" and msg.velocity == 0):
                if msg.note in active_notes:
                    onset, vel = active_notes.pop(msg.note)
                    if abs_time_s > onset:
                        events.append((onset, abs_time_s, msg.note, vel))

    if not events:
        return np.zeros(sample_rate, dtype=np.float32)

    max_end_s = max(e[1] for e in events) + 0.5
    total_samples = int(np.ceil(max_end_s * sample_rate))
    audio = np.zeros(total_samples, dtype=np.float32)

    for onset_s, offset_s, pitch, vel in events:
        freq = 440.0 * (2.0 ** ((pitch - 69) / 12.0))
        duration = offset_s - onset_s
        if duration <= 0:
            continue

        num_samples = int(np.round(duration * sample_rate))
        if num_samples <= 0:
            continue

        t = np.arange(num_samples, dtype=np.float32) / sample_rate

        harmonic1 = np.sin(2.0 * np.pi * freq * t)
        harmonic2 = 0.4 * np.sin(4.0 * np.pi * freq * t)
        harmonic3 = 0.2 * np.sin(6.0 * np.pi * freq * t)
        harmonic4 = 0.1 * np.sin(8.0 * np.pi * freq * t)
        raw_wave = harmonic1 + harmonic2 + harmonic3 + harmonic4

        attack_samples = min(int(0.01 * sample_rate), num_samples)
        release_samples = min(int(0.03 * sample_rate), num_samples)

        envelope = np.ones(num_samples, dtype=np.float32)
        if attack_samples > 0:
            envelope[:attack_samples] = np.linspace(0.0, 1.0, attack_samples)
        if release_samples > 0:
            envelope[-release_samples:] *= np.linspace(1.0, 0.0, release_samples)

        gain = (vel / 127.0) * 0.15
        note_wave = raw_wave * envelope * gain

        start_idx = int(np.round(onset_s * sample_rate))
        end_idx = start_idx + num_samples
        if end_idx <= total_samples:
            audio[start_idx:end_idx] += note_wave

    max_amp = np.max(np.abs(audio))
    if max_amp > 1e-5:
        audio = audio * (0.8 / max_amp)

    return audio


def _synthesize_midi(midi_path: Path, soundfont_path: Path) -> np.ndarray:
    """Render a MIDI file with FluidSynth (or pure Python fallback) → mono float32 array at 44100 Hz."""
    if shutil.which("fluidsynth") is None:
        return _pure_python_synth_midi(midi_path)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        synth_tmp = tmp.name
    try:
        result = subprocess.run(
            [
                "fluidsynth",
                "-ni",
                "-F",
                synth_tmp,
                "-r",
                str(_SAMPLE_RATE),
                str(soundfont_path),
                str(midi_path),
            ],
            capture_output=True,
        )
        if result.returncode != 0:
            return _pure_python_synth_midi(midi_path)

        synth_audio, _ = sf.read(synth_tmp, dtype="float32")
        if synth_audio.ndim > 1:
            synth_audio = synth_audio.mean(axis=1)
        return synth_audio
    except Exception:
        return _pure_python_synth_midi(midi_path)
    finally:
        if os.path.exists(synth_tmp):
            os.remove(synth_tmp)


def synthesize(
    midi_path: str | Path,
    output_path: str | Path,
    soundfont_path: str | Path | None = None,
) -> None:
    soundfont = _resolve_soundfont(soundfont_path)
    synth_audio = _synthesize_midi(Path(midi_path), soundfont)
    sf.write(str(output_path), synth_audio, _SAMPLE_RATE)


def auralize(
    midi_path: str | Path,
    original_audio_path: str | Path,
    output_path: str | Path,
    soundfont_path: str | Path | None = None,
) -> None:
    original_audio_path = Path(original_audio_path)
    output_path = Path(output_path)
    soundfont = _resolve_soundfont(soundfont_path)

    synth_audio = _synthesize_midi(Path(midi_path), soundfont)

    bar_offset = read_bar_offset(MidiFile(str(midi_path)))
    if bar_offset:
        synth_audio = synth_audio[round(bar_offset * _SAMPLE_RATE) :]

    original_audio = _load_mono_44k(original_audio_path)

    length = max(len(original_audio), len(synth_audio))
    original_audio = np.pad(original_audio, (0, length - len(original_audio)))
    synth_audio = np.pad(synth_audio, (0, length - len(synth_audio)))

    rms_orig = np.sqrt(np.mean(original_audio**2))
    rms_synth = np.sqrt(np.mean(synth_audio**2))
    if rms_synth > 1e-8:
        synth_audio = synth_audio * (rms_orig / rms_synth)

    stereo = np.stack([original_audio, synth_audio], axis=1)
    sf.write(str(output_path), stereo, _SAMPLE_RATE)
