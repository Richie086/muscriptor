"""Audio loading and resampling utilities. WAV is handled by the stdlib;
other formats (MP3, FLAC, OGG, M4A, …) use PyAV, soundfile, or torchaudio."""

import io
import os
import wave
from pathlib import Path
from typing import IO

import numpy as np
import torch

from muscriptor.utils.resample import resample_frac


def _read_wav_file(source) -> tuple[torch.Tensor, int]:
    """Load a PCM WAV file using the stdlib `wave` module.

    `source` may be a filesystem path or a binary file-like object.

    Returns:
        (wav, sr) where wav has shape [C, T] and is float32 in [-1, 1].
    """
    if hasattr(source, "read"):
        opened = wave.open(source, "rb")
    else:
        opened = wave.open(str(source), "rb")
    with opened as wf:
        n_channels = wf.getnchannels()
        sr = wf.getframerate()
        sampwidth = wf.getsampwidth()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    if sampwidth == 1:
        data = np.frombuffer(raw, dtype=np.uint8).astype(np.float32)
        data = (data - 128.0) / 128.0
    elif sampwidth == 2:
        data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    elif sampwidth == 3:
        bytes_ = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
        as_int32 = (
            bytes_[:, 0].astype(np.int32)
            | (bytes_[:, 1].astype(np.int32) << 8)
            | (bytes_[:, 2].astype(np.int32) << 16)
        )
        as_int32 = np.where(as_int32 >= (1 << 23), as_int32 - (1 << 24), as_int32)
        data = as_int32.astype(np.float32) / float(1 << 23)
    elif sampwidth == 4:
        data = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / float(1 << 31)
    else:
        raise ValueError(f"Unsupported WAV sample width: {sampwidth} bytes")

    data = data.reshape(-1, n_channels)
    return torch.from_numpy(np.ascontiguousarray(data.T)), sr


def _read_non_wav_file(source: str | Path | IO[bytes], filename: str | None = None) -> tuple[torch.Tensor, int]:
    """Load a non-WAV audio or video container file (e.g. MP4, M4A, AAC, WEBM, OGG, FLAC, MP3) using PyAV, soundfile, ffmpeg, or torchaudio fallback.

    `source` may be a filesystem path or a binary file-like object (e.g. an
    ``io.BytesIO`` of an uploaded file).

    Returns:
        (wav, sr) where wav has shape [C, T] and is float32 in [-1, 1].
    """
    # 1. Try PyAV (FFmpeg python bindings) — decodes MP4, M4A, AAC, WEBM, OGG, MP3, FLAC from memory or disk
    try:
        import av
        if not isinstance(source, (str, Path)) and hasattr(source, "seek"):
            source.seek(0)
        container = av.open(source)
        audio_stream = next(s for s in container.streams if s.type == "audio")
        resampler = av.AudioResampler(format="fltp")
        frames = []
        for frame in container.decode(audio_stream):
            resampled_frames = resampler.resample(frame)
            for rframe in resampled_frames:
                frames.append(rframe.to_ndarray())
        if frames:
            full_audio = np.concatenate(frames, axis=1)  # [C, T]
            sr = audio_stream.codec_context.sample_rate or 44100
            wav = torch.from_numpy(np.ascontiguousarray(full_audio))
            return wav, sr
    except Exception:
        pass

    # 2. Try soundfile directly
    try:
        import soundfile as sf
        if not isinstance(source, (str, Path)) and hasattr(source, "seek"):
            source.seek(0)
        target = str(source) if isinstance(source, (str, Path)) else source
        data, sample_rate = sf.read(target, dtype="float32")
        if data.ndim == 1:
            data = data[:, None]
        wav = torch.from_numpy(np.ascontiguousarray(data.T))
        return wav, sample_rate
    except Exception:
        pass

    # 3. Tempfile fallback with ffmpeg CLI or soundfile
    if not isinstance(source, (str, Path)):
        import tempfile
        ext = ".mp3"
        if filename:
            suffix = Path(filename).suffix
            if suffix:
                ext = suffix
        source.seek(0)
        data_bytes = source.read()
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(data_bytes)
            tmp_path = tmp.name
        try:
            # 3a. Try soundfile
            import soundfile as sf
            data, sample_rate = sf.read(tmp_path, dtype="float32")
            if data.ndim == 1:
                data = data[:, None]
            wav = torch.from_numpy(np.ascontiguousarray(data.T))
            return wav, sample_rate
        except Exception:
            pass
        try:
            # 3b. Try ffmpeg CLI fallback (extracts audio from MP4, M4A, WEBM, MOV, etc.)
            import subprocess
            cmd = ["ffmpeg", "-i", tmp_path, "-f", "wav", "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "2", "pipe:1"]
            proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            if proc.stdout:
                return _read_wav_file(io.BytesIO(proc.stdout))
        except Exception:
            pass
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    # 4. Fallback to torchaudio
    try:
        import torchaudio
        if not isinstance(source, (str, Path)) and hasattr(source, "seek"):
            source.seek(0)
        wav, sample_rate = torchaudio.load(source)
        if wav.dtype != torch.float32:
            wav = wav.to(torch.float32)
        return wav, sample_rate
    except Exception as ta_error:
        raise RuntimeError(f"Could not decode audio/video file: {ta_error}") from ta_error


def resample(
    waveform: torch.Tensor,
    orig_freq: int,
    new_freq: int,
) -> torch.Tensor:
    """Sinc resampler via julius `resample_frac`. Operates along the last dim."""
    if orig_freq == new_freq:
        return waveform
    return resample_frac(waveform, int(orig_freq), int(new_freq))


def load_audio(path: str | Path, target_sr: int = 16000) -> torch.Tensor:
    """Load an audio file (MP3, WAV, FLAC, OGG, M4A, …) and return a mono float32 tensor at target_sr.

    Returns:
        Tensor of shape [1, T] at target_sr.
    """
    filepath = Path(path)
    try:
        wav, sr = _read_wav_file(str(filepath))
    except (wave.Error, EOFError):
        wav, sr = _read_non_wav_file(str(filepath), filename=filepath.name)
    if wav.shape[0] > 1:
        wav = wav.mean(dim=0, keepdim=True)
    if sr != target_sr:
        wav = resample(wav, sr, target_sr)
    return wav
