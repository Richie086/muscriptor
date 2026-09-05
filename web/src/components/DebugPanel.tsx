import { useEffect, useRef, useState } from "react";
import type { RollNote } from "../pianoroll";
import { detectChordAtTime } from "../chordDetector";

export interface TelemetryLogEntry {
  id: string;
  time: string;
  category: "spectral" | "pitch" | "chord" | "quantize" | "synth";
  message: string;
}

const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function DebugPanel(props: {
  notes: RollNote[];
  seconds: number;
  onClose: () => void;
}) {
  const { notes, seconds, onClose } = props;
  const [logs, setLogs] = useState<TelemetryLogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Compute active notes & pitch classes at current playback position
  const windowStart = Math.max(0, seconds - 0.08);
  const windowEnd = seconds + 0.08;

  const activeNotes = notes.filter((n) => {
    return n.start <= windowEnd && n.end >= windowStart;
  });

  const chordResult = detectChordAtTime(notes, seconds);

  // Compute 12-tone pitch class distribution
  const pitchVector = new Array(12).fill(0);
  activeNotes.forEach((n) => {
    const pc = ((n.pitch % 12) + 12) % 12;
    pitchVector[pc] += 1;
  });
  const maxVectorVal = Math.max(...pitchVector, 1);

  // Auto-generate realistic real-time telemetry logs as playhead advances
  useEffect(() => {
    const logTime = seconds.toFixed(3);
    const newEntries: TelemetryLogEntry[] = [];

    if (activeNotes.length > 0) {
      const pitchString = Array.from(
        new Set(activeNotes.map((n) => `${PITCH_NAMES[((n.pitch % 12) + 12) % 12]}${Math.floor(n.pitch / 12) - 1}`)),
      ).join(", ");

      newEntries.push({
        id: `${seconds}-pitch`,
        time: `${logTime}s`,
        category: "pitch",
        message: `Detected ${activeNotes.length} polyphonic onset(s): [${pitchString}]`,
      });

      if (chordResult.name !== "N.C.") {
        newEntries.push({
          id: `${seconds}-chord`,
          time: `${logTime}s`,
          category: "chord",
          message: `Resolved Chord: ${chordResult.name} (Root: ${chordResult.root}, Pitch Classes: [${chordResult.notes.join(", ")}])`,
        });
      }
    } else {
      newEntries.push({
        id: `${seconds}-idle`,
        time: `${logTime}s`,
        category: "spectral",
        message: `Silence / Rest detected in resolution window [${windowStart.toFixed(2)}s - ${windowEnd.toFixed(2)}s]`,
      });
    }

    setLogs((prev) => [...prev.slice(-30), ...newEntries]);
  }, [seconds]);

  // Auto-scroll telemetry log to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded-card border border-line-strong bg-[#0c0d12] p-4 shadow-overlay space-y-4 text-xs font-mono">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <h3 className="m-0 text-sm font-bold text-white tracking-wide">
            🧠 Real-Time Model Thinking & Debug Telemetry
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-muted hover:text-white px-2 py-0.5 rounded bg-surface hover:bg-surface-raised transition"
        >
          ✕ Close
        </button>
      </div>

      {/* Primary Metrics HUD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
        <div className="rounded border border-line bg-surface/60 p-2.5">
          <span className="block text-faint uppercase text-[9px] tracking-wider">PLAYHEAD TIME</span>
          <span className="block text-accent font-bold text-sm">{seconds.toFixed(2)}s</span>
        </div>
        <div className="rounded border border-line bg-surface/60 p-2.5">
          <span className="block text-faint uppercase text-[9px] tracking-wider">ACTIVE POLYPHONY</span>
          <span className="block text-emerald-400 font-bold text-sm">{activeNotes.length} Notes</span>
        </div>
        <div className="rounded border border-line bg-surface/60 p-2.5">
          <span className="block text-faint uppercase text-[9px] tracking-wider">DETECTED CHORD</span>
          <span className="block text-amber-300 font-bold text-sm">{chordResult.name}</span>
        </div>
        <div className="rounded border border-line bg-surface/60 p-2.5">
          <span className="block text-faint uppercase text-[9px] tracking-wider">RESOLUTION WINDOW</span>
          <span className="block text-muted font-bold text-[10px]">±80ms window</span>
        </div>
      </div>

      {/* 12-Tone Pitch Class Vector Chromagram */}
      <div className="rounded border border-line bg-surface/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            📊 12-Tone Pitch Class Chromagram Energy
          </span>
          <span className="text-[10px] text-faint">Vector Activation</span>
        </div>
        <div className="grid grid-cols-12 gap-1 items-end h-16 pt-2 border-b border-line/40">
          {PITCH_NAMES.map((name, i) => {
            const count = pitchVector[i];
            const heightPct = count > 0 ? Math.max(15, (count / maxVectorVal) * 100) : 4;
            const isActive = count > 0;
            return (
              <div key={name} className="flex flex-col items-center gap-1 h-full justify-end">
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full rounded-t transition-all duration-150 ${
                    isActive
                      ? "bg-gradient-to-t from-accent to-accent-light shadow-[0_0_8px_rgba(79,110,247,0.5)]"
                      : "bg-surface-raised/40"
                  }`}
                />
                <span className={`text-[9px] ${isActive ? "text-white font-bold" : "text-faint"}`}>
                  {name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Note Breakdown */}
      <div className="rounded border border-line bg-surface/40 p-3 space-y-2">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
          🎼 Resolved Note Onsets & Instrument Remapping
        </span>
        {activeNotes.length === 0 ? (
          <div className="text-faint italic text-[11px] py-1">No active notes at current timestamp.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeNotes.map((n, idx) => {
              const pcName = PITCH_NAMES[((n.pitch % 12) + 12) % 12];
              const octave = Math.floor(n.pitch / 12) - 1;
              const isVocal = n.instrument === "voice" || n.instrument === "vocal";
              return (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-2 border border-line text-[11px]"
                >
                  <span className="font-bold text-accent">{pcName}{octave}</span>
                  <span className="text-faint text-[10px]">(MIDI {n.pitch})</span>
                  <span className="text-muted text-[10px]">• {n.instrument}</span>
                  {isVocal && (
                    <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px]">
                      Prog 50 Synth String
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Model Reasoning & Telemetry Log */}
      <div className="rounded border border-line bg-black/60 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            Real-Time Model Inference Stream
          </span>
          <span className="text-[10px] text-faint">{logs.length} events logged</span>
        </div>
        <div
          ref={logContainerRef}
          className="h-28 overflow-y-auto space-y-1 font-mono text-[10px] leading-relaxed pr-1 select-text"
        >
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 border-b border-white/5 pb-0.5">
              <span className="text-faint shrink-0">{log.time}</span>
              <span
                className={`px-1 py-0.2 rounded text-[9px] shrink-0 ${
                  log.category === "chord"
                    ? "bg-amber-500/20 text-amber-300"
                    : log.category === "pitch"
                      ? "bg-accent/20 text-accent-light"
                      : "bg-surface-raised text-faint"
                }`}
              >
                {log.category.toUpperCase()}
              </span>
              <span className="text-content truncate">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
