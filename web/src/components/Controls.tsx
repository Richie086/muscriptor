import { useEffect, useState, type RefObject } from "react";
import clsx from "clsx";
import type { AudioEngine } from "../audio";
import { Button } from "./Button";
import { IconPlay, IconPause } from "./icons";

export function Controls(props: {
  audio: AudioEngine;
  /** Attached to the time clock; updated imperatively by the rAF loop. */
  clockRef: RefObject<HTMLSpanElement | null>;
  mix: number;
  onMixChange: (v: number) => void;
  stereo: boolean;
  onStereoChange: (v: boolean) => void;
  /** Whether the roll auto-follows the playhead (toggled off by manual scrolling). */
  following: boolean;
  onToggleFollow: () => void;
}) {
  const { audio, clockRef, mix, onMixChange, stereo, onStereoChange, following, onToggleFollow } =
    props;
  // The transport's state isn't React state (and it can auto-stop at the end),
  // so poll it each frame to keep the toggle button's label in sync.
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setPlaying(audio.state === "started");
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audio]);

  return (
    <div className="col-span-full flex flex-wrap items-center gap-2.5 rounded-card border border-line bg-surface px-3.5 py-3 animate-rise [animation-delay:0.06s]">
      <Button
        className={clsx(
          "inline-flex items-center gap-2",
          playing && "border-accent bg-accent text-white hover:border-accent hover:bg-accent",
        )}
        onClick={(e) => {
          e.currentTarget.blur();
          playing ? audio.pause() : audio.play();
        }}
      >
        {playing ? <IconPause /> : <IconPlay />}
        {playing ? "Pause" : "Play"}
      </Button>
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
    </div>
  );
}
