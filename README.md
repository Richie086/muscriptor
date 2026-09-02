<p align="center">
  <img src="web/logo_muscriptor_final.png" alt="MuScriptor logo" width="320">
</p>

<h1 align="center">MuScriptor</h1>

<p align="center">
  <strong>Multi-Instrument Music Transcription to MIDI and Sheet Music</strong>
</p>

<p align="center">
  <a href="https://github.com/Richie086/muscriptor"><img src="https://img.shields.io/badge/GitHub-Repository-blue?logo=github" alt="GitHub Repo"></a>
  <a href="https://github.com/Richie086/muscriptor/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License"></a>
  <a href="https://huggingface.co/MuScriptor"><img src="https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-MuScriptor-yellow" alt="HuggingFace"></a>
  <a href="https://pypi.org/project/muscriptor/"><img src="https://img.shields.io/badge/Python-3.10%2B-blue" alt="Python Version"></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Frontend-React%20%7C%20Vite-646CFF?logo=vite&logoColor=white" alt="Vite"></a>
</p>

---

## 🎵 Overview

**MuScriptor** is a state-of-the-art open-source multi-instrument music transcription system developed by [Kyutai](https://kyutai.org) and [Mirelo](https://www.mirelo.ai). It analyzes audio recordings (MP3, WAV, FLAC, OGG) and transcribes them into high-accuracy multi-track MIDI, interactive piano-roll visualizations, and engraved sheet music (MusicXML/PDF).

### ✨ Key Features

- **Multi-Instrument Audio Transcription**: Separates and transcribes pitch, duration, and onset timings for multiple instruments simultaneously.
- **Interactive Web UI**: Real-time piano-roll rendering, audio playback, stem controls, and track isolation.
- **Pure-Python Audio Fallback**: Robust handling for standard and custom audio formats even in restricted environments.
- **Sheet Music & Tablature Engraving**: Generates quantized MusicXML, full score PDFs, and instrument tablatures using MuseScore 4.
- **Flexible Deployment**: Supports local Web UI hosting, CLI execution, and integration into Python applications.

---

## ⚡ Key Enhancements vs Upstream

This repository (`Richie086/muscriptor`) includes several core improvements over the original Kyutai base repository:

1. **Pure-Python Audio Processing Fallback**:
   - **Upstream**: Required native system dependencies (`fluidsynth`) to process audio soundfonts and auralizations.
   - **This Project**: Implements a pure-Python additive synthesizer fallback (`muscriptor/utils/auralization.py` & `muscriptor/utils/audio.py`) using `scipy`/`numpy` harmonic synthesis. Transcription and audio playback run smoothly even in constrained environments without native libraries.

2. **Interactive Export Hub & Client-Side MIDI Encoding**:
   - **Upstream**: Basic inline export buttons in the output bar.
   - **This Project**: Adds a comprehensive **Export Hub** modal interface (`ExportDialog.tsx`) and a custom client-side **`midiEncoder.ts`** that serializes live piano-roll notes into multi-track Standard MIDI (`.mid`) files directly in the browser.

3. **Enhanced Piano Roll UI & Controls**:
   - **Upstream**: Standard stem toggles and basic score triggers.
   - **This Project**: Improved instrument track selection, note interaction handlers (`pianoroll.ts`), and streamlined sheet music engraving actions.

4. **Project Management & CI/CD Tracking**:
   - Tracked via dedicated **GitHub Project Board #5** ([MuScriptor Development Board](https://github.com/users/Richie086/projects/5)) with feature branching and mandatory Pull Request code reviews.

---

## 🚀 Quickstart & Local Servers

### Prerequisites

- **Python**: `3.10` or newer
- **uv**: Installed via `curl -sSf https://astral.sh/uv/install.sh` or pip
- **Node.js & pnpm**: `Node.js >= 18` and `pnpm >= 9`
- **MuseScore 4** *(Optional for PDF sheet music output)*: Download from [musescore.org](https://musescore.org)

### 1. Web UI & Production Backend Server

To start the integrated server hosting both the web client and the FastAPI backend:

```bash
uv run muscriptor serve --port 8222
```

* **Local Output URL**: [http://127.0.0.1:8222](http://127.0.0.1:8222)

### 2. Frontend Hot-Reloading Development Server

If you are modifying the React frontend:

```bash
cd web
npx pnpm install
npx pnpm dev
```

* **Local Dev URL**: [http://localhost:5173](http://localhost:5173)

---

## 🛠️ Local Build Instructions

### Building the Web Frontend

Compile TypeScript and bundle static production assets into `muscriptor/web_dist/`:

```bash
cd web
npx pnpm run build
```

### Building Python Wheel & Source Packages

Build local distribution packages (includes bundled `web_dist` assets):

```bash
uv build
```

The output artifacts will be saved in `dist/`:
- `dist/muscriptor-0.3.0-py3-none-any.whl`
- `dist/muscriptor-0.3.0.tar.gz`

---

## 💻 Command-Line Interface (CLI)

### Transcribe to MIDI

```bash
uv run muscriptor transcribe path/to/song.wav
```

### Transcribe to Sheet Music (PDF & MusicXML)

```bash
uv run muscriptor transcribe path/to/song.wav --format sheets --output score/
```

**Output Structure:**
```
score/
├── score.mid                       # Quantized multi-track MIDI
├── score.musicxml                  # Engraved score as MusicXML
├── full_score.pdf                  # Full ensemble score PDF
├── 01_electric_guitar.pdf          # Individual instrument score
└── 01_electric_guitar_tab.pdf      # Tablature PDF
```

---

## 📊 Model Variants

MuScriptor model weights are hosted under the [MuScriptor HuggingFace Organization](https://huggingface.co/MuScriptor).

| Variant | Parameters | Layers | Hidden Dim | Recommended Environment |
|---|---|---|---|---|
| `small` | 103M | 14 | 768 | CPU-only / Laptops |
| `medium` *(Default)* | 307M | 24 | 1024 | Apple Silicon / Standard GPU |
| `large` | 1.4B | 48 | 1536 | High-end NVIDIA GPU |

Before first use, log into HuggingFace:
```bash
uvx hf auth login
# or set environment variable
export HF_TOKEN=hf_...
```

---

## 📂 Project Architecture

```
muscriptor/
├── muscriptor/                     # Python Core & Server Package
│   ├── server.py                   # FastAPI SSE stream & HTTP routes
│   ├── model.py                    # Transformer transcription pipeline
│   ├── utils/                      # Audio loading, auralization & MIDI helpers
│   └── web_dist/                   # Built production frontend static assets
├── web/                            # React + TypeScript + Vite Frontend
│   ├── src/
│   │   ├── components/             # PianoRoll, Controls, ExportDialog, OutputBar
│   │   ├── hooks/                  # Transcription state & SSE stream handler
│   │   └── App.tsx                 # Main UI entrypoint
│   ├── package.json
│   └── vite.config.ts
├── dist/                           # Built Python wheel & sdist packages
├── pyproject.toml                  # Python package configuration (Hatchling)
└── README.md                       # Documentation
```

---

## 📄 License

- **Code**: Released under the [MIT License](LICENSE).
- **Model Weights**: Released under [CC BY-NC 4.0 License](https://creativecommons.org/licenses/by-nc/4.0/).

---

<p align="center">
  Maintained by <a href="https://github.com/Richie086">Richie086</a> &bull; Project Board: <a href="https://github.com/users/Richie086/projects/5">MuScriptor Board</a>
</p>
