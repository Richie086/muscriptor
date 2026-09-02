"""Unit tests for multi-format audio/video container decoding utilities in muscriptor.utils.audio."""

import io
import wave
import numpy as np
import pytest
import torch
import soundfile as sf
from muscriptor.utils.audio import _read_wav_file, _read_non_wav_file, load_audio


def test_read_wav_file_bytes():
    """Verify loading standard PCM WAV from BytesIO."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes((np.sin(np.linspace(0, 440, 1600)) * 10000).astype(np.int16).tobytes())
    buf.seek(0)

    wav, sr = _read_wav_file(buf)
    assert sr == 16000
    assert isinstance(wav, torch.Tensor)
    assert wav.shape == (1, 1600)


def test_read_non_wav_flac():
    """Verify loading FLAC audio from BytesIO using soundfile/PyAV."""
    buf = io.BytesIO()
    data = np.zeros((1600, 2), dtype="float32")
    sf.write(buf, data, 22050, format="FLAC")
    buf.seek(0)

    wav, sr = _read_non_wav_file(buf, filename="test.flac")
    assert sr == 22050
    assert isinstance(wav, torch.Tensor)
    assert wav.shape[0] == 2  # stereo


def test_read_non_wav_ogg():
    """Verify loading OGG audio from BytesIO."""
    buf = io.BytesIO()
    data = np.zeros((1600, 1), dtype="float32")
    sf.write(buf, data, 44100, format="OGG", subtype="VORBIS")
    buf.seek(0)

    wav, sr = _read_non_wav_file(buf, filename="test.ogg")
    assert sr == 44100
    assert isinstance(wav, torch.Tensor)
    assert wav.shape[0] == 1  # mono


def test_load_audio_resampling(tmp_path):
    """Verify load_audio converts stereo to mono and resamples to target_sr."""
    filepath = tmp_path / "test_input.flac"
    data = np.zeros((3200, 2), dtype="float32")
    sf.write(filepath, data, 32000, format="FLAC")

    wav = load_audio(filepath, target_sr=16000)
    assert isinstance(wav, torch.Tensor)
    assert wav.shape[0] == 1  # mono converted
    assert wav.shape[1] == 1600  # resampled 32000->16000
