import { useState } from "react";

export function HelpGuide() {
  const [openSection, setOpenSection] = useState<string | null>("pianoroll");

  const sections = [
    {
      id: "transport",
      title: "🎛️ Full Audio Transport Controls & Keyboard Shortcuts",
      badge: "NEW",
      content: (
        <div className="space-y-3 text-sm text-muted">
          <p>
            Complete playback navigation controls and keyboard shortcuts:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-content">
            <li>
              <strong>Go to Start of Song (0s):</strong> Jump directly to 0.0s using the <code className="rounded bg-surface px-1.5 py-0.5 text-accent">⏮</code> button or press <code className="rounded bg-surface px-1.5 py-0.5 text-accent">Home</code> / <code className="rounded bg-surface px-1.5 py-0.5 text-accent">K</code>.
            </li>
            <li>
              <strong>Reverse / Rewind (-5s):</strong> Rewind playback 5 seconds using <code className="rounded bg-surface px-1.5 py-0.5 text-accent">⏪ -5s</code> or press <code className="rounded bg-surface px-1.5 py-0.5 text-accent">←</code> / <code className="rounded bg-surface px-1.5 py-0.5 text-accent">J</code>.
            </li>
            <li>
              <strong>Play / Pause:</strong> Toggle audio playback using <code className="rounded bg-surface px-1.5 py-0.5 text-accent">▶ Play</code> / <code className="rounded bg-surface px-1.5 py-0.5 text-accent">⏸ Pause</code> or press <code className="rounded bg-surface px-1.5 py-0.5 text-accent">Space</code>.
            </li>
            <li>
              <strong>Stop:</strong> Stop audio and reset playhead to start using <code className="rounded bg-surface px-1.5 py-0.5 text-accent">⏹ Stop</code> or press <code className="rounded bg-surface px-1.5 py-0.5 text-accent">Escape</code>.
            </li>
            <li>
              <strong>Fast Forward (+5s):</strong> Jump forward 5 seconds using <code className="rounded bg-surface px-1.5 py-0.5 text-accent">+5s ⏩</code> or press <code className="rounded bg-surface px-1.5 py-0.5 text-accent">→</code> / <code className="rounded bg-surface px-1.5 py-0.5 text-accent">L</code>.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "pianoroll",
      title: "🎹 Interactive In-Browser Piano Roll Note Editing",
      badge: "NEW",
      content: (
        <div className="space-y-3 text-sm text-muted">
          <p>
            MuScriptor features a full interactive Piano Roll editor right in your browser!
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-content">
            <li>
              <strong>Select & Drag Notes:</strong> Click any note on the canvas to select it. Drag up/down to shift pitch, or left/right to adjust onset time.
            </li>
            <li>
              <strong>Resize Duration:</strong> Drag the left or right handles of a selected note to trim or extend its duration.
            </li>
            <li>
              <strong>Add New Notes:</strong> Switch the toolbar mode to <strong>➕ Add Note</strong> and pick an instrument to place custom notes on the grid.
            </li>
            <li>
              <strong>Delete Notes:</strong> Select a note and click <strong>🗑️ Delete Note</strong> or press <code className="rounded bg-surface px-1.5 py-0.5 text-accent">Backspace</code> / <code className="rounded bg-surface px-1.5 py-0.5 text-accent">Delete</code>.
            </li>
            <li>
              <strong>Live Audio Feedback:</strong> Interactively preview pitch changes with soundfont audio synthesis while dragging.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "quantization",
      title: "⏱️ Live Quantization & Grid Snap Controls",
      badge: "NEW",
      content: (
        <div className="space-y-3 text-sm text-muted">
          <p>
            Align notes automatically to musical subdivisions with interactive grid snap controls:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-content">
            <li>
              <strong>Selectable Grid Divisions:</strong> Choose from <code className="text-accent">1/4</code>, <code className="text-accent">1/8</code>, <code className="text-accent">1/16</code>, <code className="text-accent">1/32</code>, or triplet subdivisions (<code className="text-accent">1/8t</code>, <code className="text-accent">1/16t</code>).
            </li>
            <li>
              <strong>Live Drag Snapping:</strong> When grid snap is active, moving note start/end boundaries automatically snaps to the nearest grid step.
            </li>
            <li>
              <strong>Visual Grid Lines:</strong> Dynamic accent grid lines render over the canvas to visualize note alignment.
            </li>
            <li>
              <strong>Batch Quantization:</strong> Click <strong>✨ Quantize All</strong> to instantly snap the entire transcription to the chosen BPM and grid division.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "exporthub",
      title: "💾 Client-Side MIDI Serialization & Export Hub",
      badge: "NEW",
      content: (
        <div className="space-y-3 text-sm text-muted">
          <p>
            All note edits made in the piano roll immediately update client-side state for instant MIDI generation.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-content">
            <li>
              <strong>Live MIDI Encoding:</strong> Download custom <code className="text-accent">.mid</code> files encoded directly inside your browser without needing to resubmit to the server.
            </li>
            <li>
              <strong>Multi-Format Export Hub:</strong> Download full scores, per-instrument MIDI tracks, raw WAV, and MusicXML files for MuseScore / Sibelius / Guitar Pro.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "formats",
      title: "🎧 Multi-Format Audio & Video Container Ingestion",
      badge: "NEW",
      content: (
        <div className="space-y-3 text-sm text-muted">
          <p>
            Native support for ingesting a wide range of media files:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-content">
            <li>
              <strong>Supported Formats:</strong> MP3, WAV, FLAC, OGG, M4A, AAC, WEBM, MP4, and Opus.
            </li>
            <li>
              <strong>Robust Decoding:</strong> Built-in multi-backend fallback system (PyAV, soundfile, ffmpeg, torchaudio) ensuring your files always decode cleanly.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "eightbit",
      title: "👾 8-Bit Retro Low-Resolution Synthesis",
      badge: "NEW",
      content: (
        <div className="space-y-3 text-sm text-muted">
          <p>
            Transform audio output into low-resolution, authentic 8-bit chiptune sound:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-content">
            <li>
              <strong>8-Bit Quantization:</strong> Discretizes audio amplitude to 256 levels (8-bit PCM) for true retro arcade sound.
            </li>
            <li>
              <strong>Sample-Rate Downsampling:</strong> Emulates 11kHz retro soundcard playback with step-hold sample reduction.
            </li>
            <li>
              <strong>Live WebAudio Bitcrushing:</strong> Toggle <code className="text-accent">👾 8-Bit Retro</code> in the top player toolbar for real-time retro synthesis.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "synth",
      title: "🔊 High-Fidelity & Pure-Python Audio Synthesis",
      badge: "NEW",
      content: (
        <div className="space-y-3 text-sm text-muted">
          <p>
            Seamless playback across all desktop and server environments:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-content">
            <li>
              <strong>SpessaSynth Web Worklet:</strong> Runs MuseScore General SF3 soundfont in WebAudio for ultra-low latency playback.
            </li>
            <li>
              <strong>Pure-Python Additive Fallback:</strong> Automatic harmonic synthesis fallback on backend systems without FluidSynth binary dependencies.
            </li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <section className="mx-auto max-w-3xl px-7 pb-16 pt-6">
      <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">MuScriptor Feature Guide & Help</h2>
          <p className="text-sm text-muted">Explore interactive features, editing shortcuts, and media capabilities.</p>
        </div>
        <span className="rounded-full border border-accent/30 bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">
          Feature Documentation
        </span>
      </div>

      <div className="space-y-3">
        {sections.map((s) => {
          const isOpen = openSection === s.id;
          return (
            <div
              key={s.id}
              className="rounded-card border border-line bg-[#0d0e12] transition hover:border-line/80"
            >
              <button
                type="button"
                onClick={() => setOpenSection(isOpen ? null : s.id)}
                className="flex w-full items-center justify-between p-4 text-left font-semibold text-content"
              >
                <div className="flex items-center gap-3">
                  <span>{s.title}</span>
                  {s.badge && (
                    <span className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-accent">
                      {s.badge}
                    </span>
                  )}
                </div>
                <span className={`text-muted transition-transform ${isOpen ? "rotate-90" : ""}`}>
                  ›
                </span>
              </button>
              {isOpen && <div className="border-t border-line/50 p-4 pt-3">{s.content}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
