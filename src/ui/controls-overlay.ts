import type { PlayerInputState } from "../scene/player";

// Controls overlay — bottom-left HTML panel listing keybindings. Each row's
// keys highlight while held; ? toggles panel visibility. event.code is used
// (not event.key) so the overlay is layout-independent — Dvorak / AZERTY
// players see their physical key positions highlight, not Latin letters.

interface KeyBinding {
  // CSS data-key attribute(s) — multiple variants per row (e.g. WASD + arrows)
  codes: string[];
  label: string;
  glyphs: string[]; // Display glyphs for each code
}

const BINDINGS: KeyBinding[] = [
  {
    codes: ["KeyW", "KeyA", "KeyS", "KeyD"],
    glyphs: ["W", "A", "S", "D"],
    label: "move",
  },
  {
    codes: ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"],
    glyphs: ["↑", "←", "↓", "→"],
    label: "move (alt)",
  },
  {
    codes: ["ShiftLeft"],
    glyphs: ["Shift"],
    label: "sprint",
  },
  {
    codes: ["KeyE"],
    glyphs: ["E"],
    label: "interact (gnaw / pickup / drop)",
  },
  {
    codes: ["Slash"],
    glyphs: ["?"],
    label: "toggle this panel",
  },
];

export interface ControlsOverlayHandles {
  el: HTMLDivElement;
  hidden: boolean;
  setHidden(value: boolean): void;
  destroy(): void;
}

export function createControlsOverlay(opts: {
  parent: HTMLElement;
  // Optional — when provided, mirror the player's input state into the
  // panel's `.held` highlights. Without it, the overlay still listens
  // directly to the keyboard (so the panel works independently).
  playerState?: PlayerInputState;
}): ControlsOverlayHandles {
  const el = document.createElement("div");
  el.id = "ui-controls";

  // Build rows
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
  hint.textContent = "Cozy Beaver — sandbox slice";
  el.appendChild(hint);

  opts.parent.appendChild(el);

  let hidden = false;
  const setHidden = (v: boolean) => {
    hidden = v;
    el.classList.toggle("hidden", hidden);
  };

  // Map every code in any binding → its <span> for fast lookup.
  const spans = new Map<string, HTMLSpanElement>();
  el.querySelectorAll<HTMLSpanElement>(".key[data-code]").forEach((s) => {
    spans.set(s.dataset.code!, s);
  });

  const onDown = (e: KeyboardEvent) => {
    const span = spans.get(e.code);
    if (span) span.classList.add("held");
    if (e.code === "Slash") {
      // ? is Shift+Slash on US layouts; treat any Slash as toggle so we don't
      // require Shift specifically (Dvorak / international users).
      setHidden(!hidden);
    }
  };
  const onUp = (e: KeyboardEvent) => {
    const span = spans.get(e.code);
    if (span) span.classList.remove("held");
  };

  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);

  // If we lose window focus while a key is held, clear stale held-state so the
  // panel doesn't get stuck looking like everything is pressed.
  const onBlur = () => {
    spans.forEach((s) => s.classList.remove("held"));
  };
  window.addEventListener("blur", onBlur);

  return {
    el,
    get hidden() {
      return hidden;
    },
    setHidden,
    destroy() {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      el.remove();
    },
  };
}
