import { useEffect, useState, useMemo } from "react";
import { Button } from "./Button";
import { IconDownload } from "./icons";
import { track } from "../analytics";
import type { TranscriptionResult } from "../hooks/useTranscription";
import type { RollNote } from "../pianoroll";
import { createMidiFile } from "../midiEncoder";
import { generateDrumTrack } from "../drumGenerator";
import { zipSync } from "fflate";

export function ExportDialog(props: {
  result: TranscriptionResult;
  currentFile: File | null;
  notes: RollNote[];
  instruments: string[];
  onOpenSheets: () => void;
  onClose: () => void;
}) {
  const { result, currentFile, notes, instruments, onOpenSheets, onClose } = props;

  const [loadingAudio, setLoadingAudio] = useState(false);
  const [synthAudioBlob, setSynthAudioBlob] = useState<Blob | null>(null);
  const [mixAudioBlob, setMixAudioBlob] = useState<Blob | null>(null);

  const stem = useMemo(() => {
    if (!currentFile) return "transcription";
    return currentFile.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  }, [currentFile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // Helper to fetch synthesized WAV if not already cached
  async function fetchWav(mode: "synth" | "mix"): Promise<Blob> {
    if (mode === "synth" && synthAudioBlob) return synthAudioBlob;
    if (mode === "mix" && mixAudioBlob) return mixAudioBlob;

    setLoadingAudio(true);
    try {
      const midiToUse = result.quantizedMidi ?? result.midi;
      const form = new FormData();
      form.set("midi", midiToUse, "transcription.mid");
      if (mode === "mix" && currentFile) {
        form.set("audio", currentFile, currentFile.name);
      }

      const res = await fetch(`/auralize?mode=${mode}`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (mode === "synth") setSynthAudioBlob(blob);
      if (mode === "mix") setMixAudioBlob(blob);
      return blob;
    } finally {
      setLoadingAudio(false);
    }
  }

  async function handleDownloadWav(mode: "synth" | "mix") {
    track("download", { format: `wav_${mode}` });
    const blob = await fetchWav(mode);
    saveBlob(blob, `${stem}_${mode}.wav`);
  }

  function handleDownloadMidi(quantized: boolean) {
    track("download", { format: quantized ? "midi_quantized" : "midi" });
    const blob = quantized && result.quantizedMidi ? result.quantizedMidi : result.midi;
    saveBlob(blob, `${stem}${quantized ? "_quantized" : ""}.mid`);
  }

  function handleDownloadInstrumentMidi(inst: string) {
    track("download", { format: "midi_instrument", instrument: inst });
    const instNotes = notes.filter((n) => n.instrument === inst);
    const blob = createMidiFile(instNotes, inst);
    saveBlob(blob, `${stem}_${inst}.mid`);
  }

  function handleDownloadDrumsMidi(style: "rock" | "click" = "rock") {
    track("download", { format: "midi_drums", style });
    const maxEnd = notes.length > 0 ? Math.max(...notes.map((n) => n.end)) : 0;
    const dur = maxEnd > 0 ? maxEnd : 10;
    const drumNotes = generateDrumTrack(result.beatGrid, dur, style);
    const bpm = result.beatGrid?.bpm ?? 120;
    const blob = createMidiFile(drumNotes, `MuScriptor ${style === "rock" ? "Rock Drums" : "Click Track"}`, bpm);
    saveBlob(blob, `${stem}_${style === "rock" ? "rock_drums" : "click_track"}.mid`);
  }

  async function handleDownloadZipBundle() {
    track("download", { format: "all_bundle_zip" });
    setLoadingAudio(true);
    try {
      const zipFiles: Record<string, Uint8Array> = {};

      // 1. Raw MIDI
      const midiAb = await result.midi.arrayBuffer();
      zipFiles[`${stem}.mid`] = new Uint8Array(midiAb);

      // 2. Quantized MIDI
      if (result.quantizedMidi) {
        const qAb = await result.quantizedMidi.arrayBuffer();
        zipFiles[`${stem}_quantized.mid`] = new Uint8Array(qAb);
      }

      // 3. Per-Instrument MIDIs
      for (const inst of instruments) {
        const instNotes = notes.filter((n) => n.instrument === inst);
        if (instNotes.length > 0) {
          const instBlob = createMidiFile(instNotes, inst);
          zipFiles[`instruments/${inst}.mid`] = new Uint8Array(await instBlob.arrayBuffer());
        }
      }

      // 3b. Rock drum & click track accompaniment MIDIs
      const maxEnd = notes.length > 0 ? Math.max(...notes.map((n) => n.end)) : 0;
      const dur = maxEnd > 0 ? maxEnd : 10;
      const bpm = result.beatGrid?.bpm ?? 120;
      const rockBlob = createMidiFile(generateDrumTrack(result.beatGrid, dur, "rock"), "MuScriptor Rock Drums", bpm);
      zipFiles[`accompaniment/${stem}_rock_drums.mid`] = new Uint8Array(await rockBlob.arrayBuffer());
      const clickBlob = createMidiFile(generateDrumTrack(result.beatGrid, dur, "click"), "MuScriptor Click Track", bpm);
      zipFiles[`accompaniment/${stem}_click_track.mid`] = new Uint8Array(await clickBlob.arrayBuffer());

      // 4. Source audio if present
      if (currentFile) {
        const srcAb = await currentFile.arrayBuffer();
        zipFiles[`original_${currentFile.name}`] = new Uint8Array(srcAb);
      }

      // 5. Synthesized audio
      try {
        const synthBlob = await fetchWav("synth");
        zipFiles[`${stem}_synthesized.wav`] = new Uint8Array(await synthBlob.arrayBuffer());
      } catch (e) {
        console.warn("Could not fetch synth audio for zip bundle", e);
      }

      const zipped = zipSync(zipFiles);
      const zipBlob = new Blob([zipped], { type: "application/zip" });
      saveBlob(zipBlob, `${stem}_muscriptor_bundle.zip`);
    } finally {
      setLoadingAudio(false);
    }
  }

  async function handleDownloadGuitarTabs() {
    track("download", { format: "guitar_tabs_chords" });
    setLoadingAudio(true);
    try {
      const midiToUse = result.quantizedMidi ?? result.midi;
      const form = new FormData();
      form.set("midi", midiToUse, "transcription.mid");

      const res = await fetch("/tabs", {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      saveBlob(blob, `${stem}_guitar_tabs_chords.txt`);
    } finally {
      setLoadingAudio(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-[rgba(11,12,16,0.72)] p-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export Center"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-card border border-line-strong bg-surface shadow-overlay"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="m-0 text-lg font-semibold text-content">Export Hub</h2>
            <p className="m-0 text-xs text-muted">
              Download MIDI stems, synthesized audio, guitar tabs, and full score packages.
            </p>
          </div>
          <Button onClick={onClose} kind="ghost" pad="px-3 py-1.5" className="text-xs">
            ✕ Close
          </Button>
        </div>

        {/* 1-Click ZIP Bundle Banner */}
        <div className="border-b border-line bg-accent-1/10 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="inline-block font-mono text-[10px] uppercase tracking-wider text-accent-1">
                All-in-One Export
              </span>
              <h3 className="m-0 text-sm font-semibold text-content">Complete Project Archive (.zip)</h3>
              <p className="m-0 text-xs text-muted">
                Includes raw & quantized MIDI, instrument stems, synthesized WAV audio, and source file.
              </p>
            </div>
            <Button
              kind="primary"
              disabled={loadingAudio}
              className="inline-flex shrink-0 items-center gap-2"
              onClick={handleDownloadZipBundle}
            >
              <IconDownload />
              {loadingAudio ? "Preparing Bundle..." : "Download Complete Bundle"}
            </Button>
          </div>
        </div>

        {/* Export Options Grid */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
          {/* MuseScore Recommendation Banner */}
          <div className="rounded-card border border-accent/30 bg-accent/10 p-3.5 text-xs text-content flex items-start gap-3">
            <span className="text-lg leading-none">🎼</span>
            <div>
              <span className="font-semibold text-accent-light">Recommended Notation Software:</span>{" "}
              We recommend using{" "}
              <a
                href="https://musescore.org/en"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-accent underline underline-offset-2 hover:text-accent-light"
              >
                MuseScore (https://musescore.org/en)
              </a>
              , which is free, open source, and available for Mac, Linux, and Windows.
            </div>
          </div>

          {/* MIDI Files */}
          <div>
            <h4 className="m-0 mb-3 text-xs font-bold uppercase tracking-wider text-muted">
              🎵 MIDI Files
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                kind="secondary"
                pad="p-3"
                className="flex flex-col items-start text-left gap-1"
                onClick={() => handleDownloadMidi(false)}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-sm text-content">Raw MIDI</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-raised border border-line text-muted">
                    .mid
                  </span>
                </div>
                <span className="text-xs text-muted">Exact transcribed performance timing</span>
              </Button>

              {result.quantizedMidi && (
                <Button
                  kind="secondary"
                  pad="p-3"
                  className="flex flex-col items-start text-left gap-1"
                  onClick={() => handleDownloadMidi(true)}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-sm text-content">Quantized MIDI</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-raised border border-line text-accent-1">
                      GRID MATCHED
                    </span>
                  </div>
                  <span className="text-xs text-muted">Beat-aligned timing for DAWs & sheet music</span>
                </Button>
              )}
            </div>

            {/* Instrument Stems */}
            {instruments.length > 0 && (
              <div className="mt-3 pt-3 border-t border-line/50">
                <span className="block text-[11px] font-medium text-muted mb-2">
                  Individual Instrument MIDI Stems:
                </span>
                <div className="flex flex-wrap gap-2">
                  {instruments.map((inst) => (
                    <Button
                      key={inst}
                      kind="ghost"
                      pad="px-2.5 py-1"
                      className="text-xs rounded border border-line hover:border-accent-1 text-content flex items-center gap-1.5"
                      onClick={() => handleDownloadInstrumentMidi(inst)}
                    >
                      <IconDownload />
                      <span>{inst.replace(/_/g, " ")}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Rhythm & Click Accompaniment Stems */}
            <div className="mt-3 pt-3 border-t border-line/50">
              <span className="block text-[11px] font-medium text-muted mb-2">
                🥁 Rhythm & Click Accompaniment Stems (GM Channel 10):
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  kind="ghost"
                  pad="px-2.5 py-1"
                  className="text-xs rounded border border-amber-500/40 hover:border-amber-400 text-amber-300 flex items-center gap-1.5"
                  onClick={() => handleDownloadDrumsMidi("rock")}
                >
                  <IconDownload />
                  <span>Rock Drum Groove (Kick 1&3, Snare 2&4)</span>
                </Button>
                <Button
                  kind="ghost"
                  pad="px-2.5 py-1"
                  className="text-xs rounded border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 flex items-center gap-1.5"
                  onClick={() => handleDownloadDrumsMidi("click")}
                >
                  <IconDownload />
                  <span>Metronome Click Track</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Audio Files */}
          <div>
            <h4 className="m-0 mb-3 text-xs font-bold uppercase tracking-wider text-muted">
              🔊 Audio Renderings (WAV)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                kind="secondary"
                pad="p-3"
                disabled={loadingAudio}
                className="flex flex-col items-start text-left gap-1"
                onClick={() => handleDownloadWav("synth")}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-sm text-content">Synthesized WAV</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-raised border border-line text-muted">
                    SoundFont
                  </span>
                </div>
                <span className="text-xs text-muted">Full audio playback of transcribed MIDI</span>
              </Button>

              <Button
                kind="secondary"
                pad="p-3"
                disabled={loadingAudio || !currentFile}
                className="flex flex-col items-start text-left gap-1"
                onClick={() => handleDownloadWav("mix")}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-sm text-content">Stereo Comparison Mix</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-raised border border-line text-muted">
                    L:Original / R:Synth
                  </span>
                </div>
                <span className="text-xs text-muted">Original in left ear, synthesis in right</span>
              </Button>
            </div>
          </div>

          {/* Guitar Tab & Sheet Music */}
          <div>
            <h4 className="m-0 mb-3 text-xs font-bold uppercase tracking-wider text-muted">
              🎸 Guitar Tabs & Sheet Music
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-card border border-line bg-surface-raised p-4 flex flex-col justify-between">
                <div>
                  <h5 className="m-0 text-sm font-semibold text-content">
                    Guitar Tabs & Chord Chart
                  </h5>
                  <p className="m-0 text-xs text-muted mt-1">
                    ASCII 6-string tab & detected chords (Root, triad, 7th) formatted per measure.
                  </p>
                </div>
                <Button
                  kind="secondary"
                  disabled={loadingAudio}
                  className="mt-3 inline-flex items-center justify-center gap-2"
                  onClick={handleDownloadGuitarTabs}
                >
                  <IconDownload />
                  Download Guitar Tabs (.txt)
                </Button>
              </div>

              <div className="rounded-card border border-line bg-surface-raised p-4 flex flex-col justify-between">
                <div>
                  <h5 className="m-0 text-sm font-semibold text-content">
                    Engraved PDFs & MusicXML
                  </h5>
                  <p className="m-0 text-xs text-muted mt-1">
                    Full score PDFs, per-instrument notation, and engraved tab staves via MuseScore.
                  </p>
                </div>
                <Button
                  kind="primary"
                  className="mt-3 inline-flex items-center justify-center gap-2"
                  onClick={() => {
                    onClose();
                    onOpenSheets();
                  }}
                >
                  <IconDownload />
                  Sheet Music Engraver
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-line px-6 py-3 flex justify-end bg-surface">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
