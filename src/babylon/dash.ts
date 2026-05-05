// Double-tap-to-dash mechanic. Detects two presses of the same direction key
// within DOUBLE_TAP_MS, then triggers a brief speed burst in that direction
// with i-frames. Cooldown prevents spam.
//
// Keys: WASD + arrow equivalents. Direction is *camera-relative* (matches the
// existing camera-relative WASD in player.ts).

const DOUBLE_TAP_MS = 300;
const DASH_DURATION_MS = 250;
const COOLDOWN_MS = 1500;
export const DASH_SPEED_MULT = 4.5;

export type DashDirKey = "F" | "B" | "L" | "R";

export interface DashState {
  active: boolean;
  endTime: number;
  cooldownEnd: number;
  invulnUntil: number;
  // f∈{-1,0,1} backward/none/forward; r∈{-1,0,1} left/none/right.
  // Camera-relative — player.ts feeds these into the same move vector code.
  dirF: number;
  dirR: number;
}

export interface DashHandles {
  state: DashState;
  isDashing(): boolean;
  isInvulnerable(): boolean;
  destroy(): void;
}

function keyToDir(code: string): DashDirKey | null {
  switch (code) {
    case "KeyW":
    case "ArrowUp":
      return "F";
    case "KeyS":
    case "ArrowDown":
      return "B";
    case "KeyA":
    case "ArrowLeft":
      return "L";
    case "KeyD":
    case "ArrowRight":
      return "R";
    default:
      return null;
  }
}

export function createDashSystem(): DashHandles {
  const lastTap: Record<DashDirKey, number> = { F: 0, B: 0, L: 0, R: 0 };

  const state: DashState = {
    active: false,
    endTime: 0,
    cooldownEnd: 0,
    invulnUntil: 0,
    dirF: 0,
    dirR: 0,
  };

  const trigger = (key: DashDirKey, now: number): void => {
    if (now < state.cooldownEnd) return;
    state.active = true;
    state.endTime = now + DASH_DURATION_MS;
    state.cooldownEnd = now + COOLDOWN_MS;
    state.invulnUntil = now + DASH_DURATION_MS + 50; // tiny buffer past dash end
    state.dirF = key === "F" ? 1 : key === "B" ? -1 : 0;
    state.dirR = key === "R" ? 1 : key === "L" ? -1 : 0;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;  // browser auto-repeat while held — ignore
    const key = keyToDir(e.code);
    if (!key) return;
    const now = performance.now();
    const last = lastTap[key];
    if (last && now - last < DOUBLE_TAP_MS) {
      trigger(key, now);
      lastTap[key] = 0;  // reset so triple-tap doesn't immediately re-dash
    } else {
      lastTap[key] = now;
    }
  };

  window.addEventListener("keydown", onKeyDown);

  return {
    state,
    isDashing(): boolean {
      if (state.active && performance.now() >= state.endTime) state.active = false;
      return state.active;
    },
    isInvulnerable(): boolean {
      return performance.now() < state.invulnUntil;
    },
    destroy(): void {
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
