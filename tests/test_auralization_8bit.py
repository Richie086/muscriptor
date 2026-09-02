import numpy as np
import pytest
from muscriptor.utils.auralization import quantize_8bit


def test_quantize_8bit_basic():
    t = np.linspace(0, 1, 44100, dtype=np.float32)
    sine_wave = np.sin(2 * np.pi * 440 * t)

    quantized = quantize_8bit(sine_wave, bits=8, downsample_factor=4)

    assert len(quantized) == len(sine_wave)
    # Check that unique values are discretized (significantly fewer unique values than smooth sine)
    unique_vals = np.unique(quantized)
    assert len(unique_vals) <= 256
    assert len(unique_vals) > 5


def test_quantize_8bit_empty():
    empty = np.array([], dtype=np.float32)
    result = quantize_8bit(empty)
    assert len(result) == 0
