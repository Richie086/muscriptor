import { useEffect, useState, type RefObject } from "react";
import clsx from "clsx";
import type { AudioEngine } from "../audio";
import { Button } from "./Button";
import {
  IconPlay,
  IconPause,
  IconStop,
  IconRewind,
  IconFastForward,
  IconSkipBack,
} from "./icons";

export function Controls(props: {
  audio: AudioEngine;
  /** Attached to the time clock; updated imperatively by the rAF loop. */
  clockRef: RefObject<HTMLSpanElement | null>;
  /** Attached to real-time chord display; updated imperatively by the rAF loop. */
  chordRef?: RefObject<HTMLSpanElement | null>;
  mix: number;
  onMixChange: (v: number) => void;
  stereo: boolean;
  onStereoChange: (v: boolean) => void;
  /** Whether the roll auto-follows the playhead (toggled off by manual scrolling). */
  following: boolean;
  onToggleFollow: () => void;
  showDebug: boolean;
  onToggleDebug: () => void;
}) {
  const {
    audio,
    clockRef,
    chordRef,
    mix,
    onMixChange,
    stereo,
    onStereoChange,
    following,
    onToggleFollow,
    showDebug,
    onToggleDebug,
  } = props;
  // The transport's state isn't React state (and it can auto-stop at the end),
  // so poll it each frame to keep the toggle button's label in sync.
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setPlaying(audio.state === "started");
      setPaused(audio.state === "paused");
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audio]);

  const handleStart = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    audio.seek(0);
  };

  const handleReverse = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    audio.seek(Math.max(0, audio.seconds - 5));
  };

  const handlePlay = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    audio.play();
  };

  const handlePause = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    audio.pause();
  };

  const handleStop = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    audio.stop();
  };

  const handleFastForward = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    const dur = audio.duration || Infinity;
    audio.seek(Math.min(dur, audio.seconds + 5));
  };

  return (
    <div className="col-span-full flex flex-wrap items-center gap-2.5 rounded-card border border-line bg-surface px-3.5 py-3 animate-rise [animation-delay:0.06s]">
      {/* Transport Control Cluster */}
      <div className="flex items-center gap-1 rounded-lg border border-line-strong bg-surface-2 p-1 shadow-sm">
        {/* Go to Start */}
        <button
          type="button"
          onClick={handleStart}
          title="Go to start of song (0.0s) [Home]"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-white/10 hover:text-white active:scale-95"
        >
          <IconSkipBack />
        </button>

        {/* Reverse / Rewind (-5s) */}
        <button
          type="button"
          onClick={handleReverse}
          title="Reverse 5 seconds [←]"
          className="flex h-8 px-2 items-center justify-center gap-1 rounded-md text-xs font-medium text-muted transition-colors hover:bg-white/10 hover:text-white active:scale-95"
        >
          <IconRewind />
          <span>-5s</span>
        </button>

        {/* Play */}
        <button
          type="button"
          onClick={handlePlay}
          title="Play [Space]"
          className={clsx(
            "flex h-8 px-3 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-all active:scale-95",
            playing
              ? "bg-accent text-white shadow-md ring-1 ring-accent-1"
              : "bg-surface-3 text-content hover:bg-white/15 hover:text-white",
          )}
        >
          <IconPlay />
          <span>Play</span>
        </button>

        {/* Pause */}
        <button
          type="button"
          onClick={handlePause}
          title="Pause [Space]"
          className={clsx(
            "flex h-8 px-3 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-all active:scale-95",
            paused
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              : "text-muted hover:bg-white/10 hover:text-white",
          )}
        >
          <IconPause />
          <span>Pause</span>
        </button>

        {/* Stop */}
        <button
          type="button"
          onClick={handleStop}
          title="Stop and reset to start [Esc]"
          className="flex h-8 px-2.5 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-muted transition-colors hover:bg-red-500/20 hover:text-red-300 active:scale-95"
        >
          <IconStop />
          <span>Stop</span>
        </button>

        {/* Fast Forward (+5s) */}
        <button
          type="button"
          onClick={handleFastForward}
          title="Fast forward 5 seconds [→]"
          className="flex h-8 px-2 items-center justify-center gap-1 rounded-md text-xs font-medium text-muted transition-colors hover:bg-white/10 hover:text-white active:scale-95"
        >
          <span>+5s</span>
          <IconFastForward />
        </button>
      </div>
      <Button
        className={clsx("text-content", following && "border-accent hover:border-accent")}
        aria-pressed={following}
        title={following ? "Stop following the playhead" : "Scroll along with the playhead"}
        onClick={(e) => {
          e.currentTarget.blur();
          onToggleFollow();
        }}
      >
        Follow playhead
      </Button>
      <Button
        className={clsx(
          "text-content transition-all",
          showDebug && "border-emerald-500/60 bg-emerald-500/15 text-emerald-300 shadow-sm",
        )}
        aria-pressed={showDebug}
        title="Toggle Real-Time Model Thinking & Debug Telemetry Panel"
        onClick={(e) => {
          e.currentTarget.blur();
          onToggleDebug();
        }}
      >
        🧠 Model Debug
      </Button>
      <Button
        className="text-content hover:text-white"
        title="View Feature Guide & Shortcuts"
        onClick={() => {
          document.getElementById("help-guide-section")?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        ❓ Help & Features
      </Button>
      <span
        className="rounded-md border border-line bg-bg px-2.5 py-1 font-mono text-sm tabular-nums text-muted"
        ref={clockRef}
      >
        0.0s
      </span>

      {/* Real-Time Active Chord Display Badge */}
      <div
        className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3 py-1 text-sm font-semibold text-accent shadow-sm backdrop-blur-sm"
        title="Real-time approximated active chord"
      >
        <span className="text-[10px] font-extrabold tracking-widest text-accent-light opacity-80">CHORD</span>
        <span
          ref={chordRef}
          className="min-w-[3rem] text-center font-mono text-base font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
        >
          N.C.
        </span>
      </div>
      <label
        className={clsx(
          "ml-auto inline-flex items-center gap-2.5 text-sm text-muted max-[760px]:ml-0",
          stereo && "opacity-40",
        )}
      >
        <span
          className={clsx(
            "min-w-8 text-center transition-colors",
            !stereo && "cursor-pointer hover:text-content",
          )}
          onClick={() => !stereo && onMixChange(0)}
        >
          Original
        </span>
        <input
          className="mix-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={mix}
          disabled={stereo}
          onChange={(e) => onMixChange(parseFloat(e.target.value))}
          onPointerUp={(e) => e.currentTarget.blur()}
          onClick={(e) => e.currentTarget.blur()}
        />
        <span
          className={clsx(
            "min-w-8 text-center transition-colors",
            !stereo && "cursor-pointer hover:text-content",
          )}
          onClick={() => !stereo && onMixChange(1)}
        >
          MIDI
        </span>
      </label>
      <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-sm text-muted px-3">
        <input
          className="cursor-pointer accent-accent"
          type="checkbox"
          checked={stereo}
          onChange={(e) => onStereoChange(e.target.checked)}
          onClick={(e) => e.currentTarget.blur()}
        />
        <span>Stereo</span>
      </label>
      <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-sm text-muted px-3">
        <input
          className="cursor-pointer accent-accent"
          type="checkbox"
          checked={audio.getEightBitMode()}
          onChange={(e) => {
            audio.setEightBitMode(e.target.checked);
            e.currentTarget.blur();
          }}
        />
        <span className={clsx(audio.getEightBitMode() && "text-accent font-semibold")}>👾 8-Bit Retro</span>
      </label>
    </div>
  );
}
