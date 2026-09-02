import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { type AudioEngine, INSTRUMENT_ORDER } from "../audio";
import { PianoRoll, KEY_WIDTH, type RollNote } from "../pianoroll";

export function PianoRollCanvas(props: {
  rollRef: RefObject<PianoRoll | null>;
  audio: AudioEngine;
  setUserScrolled: Dispatch<SetStateAction<boolean>>;
}) {
  const { rollRef, audio, setUserScrolled } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [editTool, setEditTool] = useState<"select" | "add" | "scrub">("select");
  const [selectedInstrument, setSelectedInstrument] = useState<string>("acoustic_piano");
  const [selectedNote, setSelectedNote] = useState<RollNote | null>(null);

  const handleDeleteSelected = () => {
    if (!selectedNote || !rollRef.current) return;
    rollRef.current.deleteNote(selectedNote);
    setSelectedNote(null);
    audio.reloadNotes(rollRef.current.getNotes());
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const roll = new PianoRoll(canvas);
    rollRef.current = roll;

    let noteDrag: {
      note: RollNote;
      hitArea: "start" | "end" | "body";
      startX: number;
      startY: number;
      origStart: number;
      origEnd: number;
      origPitch: number;
    } | null = null;

    let scrub: { wasPlaying: boolean } | null = null;
    const scrubTo = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const t = clientX < rect.left ? 0 : Math.max(0, roll.xToSeconds(clientX - rect.left));
      audio.scrubTo(t);
      roll.setPlayhead(t);
    };

    let keyDrag: { x: number; y: number } | null = null;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.01);
      if (e.altKey) {
        roll.zoomPitch(factor, e.clientY - rect.top);
        setUserScrolled(true);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        roll.zoomTime(factor, e.clientX - rect.left);
        setUserScrolled(true);
        return;
      }
      if (e.shiftKey) {
        const d = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        if (d !== 0) roll.scrollBy(d / roll.pxPerSec);
      } else {
        if (e.deltaX !== 0) roll.scrollBy(e.deltaX / roll.pxPerSec);
        if (e.deltaY !== 0) roll.scrollPitchBy(-e.deltaY);
      }
      setUserScrolled(true);
    };

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (x < KEY_WIDTH) {
        keyDrag = { x, y };
        e.preventDefault();
        return;
      }

      const hit = roll.hitTestNote(x, y);

      if (editTool === "add" && !hit) {
        const pitch = roll.yToPitch(y);
        const start = roll.xToSeconds(x);
        const newNote: RollNote = {
          pitch,
          start,
          end: start + 0.25,
          instrument: selectedInstrument,
        };
        roll.addNote(newNote);
        roll.setSelectedNote(newNote);
        setSelectedNote({ ...newNote });
        audio.previewPitch(newNote.instrument, newNote.pitch);
        audio.reloadNotes(roll.getNotes());
        e.preventDefault();
        return;
      }

      if (hit && editTool !== "scrub") {
        roll.setSelectedNote(hit.note);
        setSelectedNote({ ...hit.note });
        audio.previewPitch(hit.note.instrument, hit.note.pitch);

        noteDrag = {
          note: hit.note,
          hitArea: hit.hitArea,
          startX: e.clientX,
          startY: e.clientY,
          origStart: hit.note.start,
          origEnd: hit.note.end,
          origPitch: hit.note.pitch,
        };
        e.preventDefault();
        return;
      }

      // Deselect note if clicked empty space
      roll.setSelectedNote(null);
      setSelectedNote(null);

      scrub = { wasPlaying: audio.state === "started" };
      if (scrub.wasPlaying) audio.pause();
      scrubTo(e.clientX);
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (noteDrag) {
        const dx = e.clientX - noteDrag.startX;
        const dt = dx / roll.pxPerSec;

        if (noteDrag.hitArea === "body") {
          const newPitch = roll.yToPitch(y);
          if (newPitch !== noteDrag.note.pitch) {
            noteDrag.note.pitch = newPitch;
            audio.previewPitch(noteDrag.note.instrument, newPitch);
          }
          const dur = noteDrag.origEnd - noteDrag.origStart;
          noteDrag.note.start = Math.max(0, noteDrag.origStart + dt);
          noteDrag.note.end = noteDrag.note.start + dur;
        } else if (noteDrag.hitArea === "start") {
          noteDrag.note.start = Math.max(0, Math.min(noteDrag.origEnd - 0.05, noteDrag.origStart + dt));
        } else if (noteDrag.hitArea === "end") {
          noteDrag.note.end = Math.max(noteDrag.note.start + 0.05, noteDrag.origEnd + dt);
        }
        setSelectedNote({ ...noteDrag.note });
        return;
      }

      if (scrub) {
        scrubTo(e.clientX);
        return;
      }

      if (keyDrag) {
        const dx = x - keyDrag.x;
        const dy = y - keyDrag.y;
        if (dx !== 0) roll.zoomPitch(Math.exp(dx * 0.01), y);
        if (dy !== 0) roll.scrollPitchBy(dy);
        keyDrag = { x, y };
        setUserScrolled(true);
        return;
      }

      if (x < KEY_WIDTH) {
        canvas.style.cursor = "ew-resize";
      } else {
        const hit = roll.hitTestNote(x, y);
        if (hit) {
          canvas.style.cursor = hit.hitArea === "body" ? "grab" : "ew-resize";
        } else if (editTool === "add") {
          canvas.style.cursor = "crosshair";
        } else {
          canvas.style.cursor = "default";
        }
      }
    };

    const onMouseUp = () => {
      if (noteDrag) {
        audio.reloadNotes(roll.getNotes());
        noteDrag = null;
      }
      if (scrub) {
        audio.seek(audio.seconds);
        if (scrub.wasPlaying) audio.play();
        scrub = null;
      }
      keyDrag = null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const sel = roll.getSelectedNote();
        if (sel) {
          e.preventDefault();
          roll.deleteNote(sel);
          setSelectedNote(null);
          audio.reloadNotes(roll.getNotes());
        }
      } else if (e.key === "Escape") {
        roll.setSelectedNote(null);
        setSelectedNote(null);
      }
    };

    let pan: { x: number; y: number } | null = null;
    let pinch: { dx: number; dy: number } | null = null;
    const pinchSpan = (t: TouchList) => ({
      dx: Math.abs(t[0].clientX - t[1].clientX),
      dy: Math.abs(t[0].clientY - t[1].clientY),
    });

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinch = pinchSpan(e.touches);
        pan = null;
        e.preventDefault();
      } else if (e.touches.length === 1) {
        pan = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        const span = pinchSpan(e.touches);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const MIN = 12;
        if (pinch.dx > MIN && span.dx > MIN) roll.zoomTime(span.dx / pinch.dx, cx);
        if (pinch.dy > MIN && span.dy > MIN) roll.zoomPitch(span.dy / pinch.dy, cy);
        pinch = span;
        setUserScrolled(true);
      } else if (pan && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        roll.scrollBy(-(t.clientX - pan.x) / roll.pxPerSec);
        roll.scrollPitchBy(t.clientY - pan.y);
        pan = { x: t.clientX, y: t.clientY };
        setUserScrolled(true);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
      if (e.touches.length === 0) pan = null;
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [audio, editTool, rollRef, selectedInstrument, setUserScrolled]);

  return (
    <section className="relative col-start-1 overflow-hidden rounded-card border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_60px),#0a0b0e] p-0 shadow-canvas animate-rise [animation-delay:0.12s]">
      {/* Piano Roll Edit Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[#12141a] px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-muted">Mode:</span>
          <button
            type="button"
            onClick={() => setEditTool("select")}
            className={`rounded px-2.5 py-1 font-medium transition ${
              editTool === "select"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface text-muted hover:text-white"
            }`}
          >
            ✏️ Select & Edit
          </button>
          <button
            type="button"
            onClick={() => setEditTool("add")}
            className={`rounded px-2.5 py-1 font-medium transition ${
              editTool === "add"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface text-muted hover:text-white"
            }`}
          >
            ➕ Add Note
          </button>
          <button
            type="button"
            onClick={() => setEditTool("scrub")}
            className={`rounded px-2.5 py-1 font-medium transition ${
              editTool === "scrub"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface text-muted hover:text-white"
            }`}
          >
            📍 Scrub
          </button>
        </div>

        {editTool === "add" && (
          <div className="flex items-center gap-2">
            <span className="text-muted">Instrument:</span>
            <select
              value={selectedInstrument}
              onChange={(e) => setSelectedInstrument(e.target.value)}
              className="rounded border border-line bg-surface px-2 py-1 text-content focus:border-accent focus:outline-none"
            >
              {INSTRUMENT_ORDER.map((name: string) => (
                <option key={name} value={name}>
                  {name.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedNote && (
          <div className="flex items-center gap-3">
            <span className="font-mono text-content">
              Pitch {selectedNote.pitch} | {selectedNote.start.toFixed(2)}s – {selectedNote.end.toFixed(2)}s
            </span>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="rounded bg-rose-600/80 px-2 py-1 font-medium text-white hover:bg-rose-500"
            >
              🗑️ Delete Note
            </button>
          </div>
        )}
      </div>

      <canvas className="block h-[420px] w-full" width={1200} height={400} ref={canvasRef} />
    </section>
  );
}
