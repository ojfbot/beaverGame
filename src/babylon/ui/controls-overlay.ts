import type { PlayerInputState } from "../player";

// Controls overlay — bottom-left HTML panel. Engine-agnostic (DOM only);
// straight port from src/ui/controls-overlay.ts. Only the import path
// changes (PlayerInputState comes from babylon/player now).

interface KeyBinding {
  codes: string[];
  label: string;
  glyphs: string[];
}

const BINDINGS: KeyBinding[] = [
  { codes: ["KeyW", "KeyA", "KeyS", "KeyD"], glyphs: ["W", "A", "S", "D"], label: "move" },
  { codes: ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"], glyphs: ["↑", "←", "↓", "→"], label: "move (alt)" },
  { codes: ["ShiftLeft"], glyphs: ["Shift"], label: "sprint" },
  { codes: ["KeyE"], glyphs: ["E"], label: "interact (gnaw / pickup / drop)" },
  { codes: ["Slash"], glyphs: ["?"], label: "toggle this panel" },
];

export interface ControlsOverlayHandles {
  el: HTMLDivElement;
  hidden: boolean;
  setHidden(value: boolean): void;
  destroy(): void;
}

export function createControlsOverlay(opts: {
  parent: HTMLElement;
  playerState?: PlayerInputState;
}): ControlsOverlayHandles {
  void opts.playerState;
  const el = document.createElement("div");
  el.id = "ui-controls";

  for (const b of BINDINGS) {
    const row = document.createElement("div");
    row.className = "row";
    const keys = document.createElement("span");
    keys.className = "keys";
    for (let i = 0; i < b.codes.length; i++) {
      const span = document.createElement("span");
      span.className = "key";
      span.dataset.code = b.codes[i]!;
      span.textContent = b.glyphs[i]!;
      keys.appendChild(span);
    }
    row.appendChild(keys);
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = b.label;
    row.appendChild(label);
    el.appendChild(row);
  }

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Cozy Beaver — Babylon migration in progress";
  el.appendChild(hint);

  opts.parent.appendChild(el);

  let hidden = false;
  const setHidden = (v: boolean) => {
    hidden = v;
    el.classList.toggle("hidden", hidden);
  };

  const spans = new Map<string, HTMLSpanElement>();
  el.querySelectorAll<HTMLSpanElement>(".key[data-code]").forEach((s) => {
    spans.set(s.dataset.code!, s);
  });

  const onDown = (e: KeyboardEvent) => {
    const span = spans.get(e.code);
    if (span) span.classList.add("held");
    if (e.code === "Slash") setHidden(!hidden);
  };
  const onUp = (e: KeyboardEvent) => {
    const span = spans.get(e.code);
    if (span) span.classList.remove("held");
  };
  const onBlur = () => spans.forEach((s) => s.classList.remove("held"));

  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", onBlur);

  return {
    el,
    get hidden() { return hidden; },
    setHidden,
    destroy() {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      el.remove();
    },
  };
}
