import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import type { TreeInstance } from "./world";
import type { PlayerHandles } from "./player";
import type { ColliderRegistry } from "./collision";
import { spawnLog, type LogEntity } from "./log";
import { spawnStump, type StumpHandles } from "./stump";
import { createWoodChips, type ChipsHandles } from "./particles";
import type { FallWarningHandles } from "./falling-warning";

// Trunk-strike parameters (used by the dodge mechanic). Strike width matches
// the cone-wedge's tip half-width so the visual warning lines up with the hit
// zone — no "I was outside the cone but got hit" or vice versa.
const TRUNK_LENGTH = 3.0;
const STRIKE_HALF_WIDTH = 0.7;
const STRIKE_THRESHOLD_U = 0.5;

// Hold E within INTERACT_RANGE of a tree → gnaw progress accumulates →
// at 1.0, tree falls (eased tween) → log + stump spawn, trunk collider
// swaps for the smaller stump collider.

const INTERACT_RANGE = 1.6;
const GNAW_TIME = 2.6;
const FALL_DURATION = 1.0;
const CHIP_INTERVAL_S = 0.18;

export interface FellingHandles {
  trees: TreeInstance[];
  logs: LogEntity[];
  stumps: StumpHandles[];
  chips: ChipsHandles;
  update(dt: number, player: PlayerHandles): void;
  destroy(): void;
}

export interface FellingOpts {
  scene: Scene;
  trees: TreeInstance[];
  colliders?: ColliderRegistry;
  // Optional fall-warning visuals. When provided, felling notifies show/hide.
  warning?: FallWarningHandles;
  // Called the first frame the falling trunk overlaps the player's footprint
  // (and the player is not invulnerable). Implemented as a one-shot — guards
  // against repeat fires.
  onSquash?: (treeId: string) => void;
  // Returns true while the player can't be hit (dash i-frames, etc.).
  isPlayerInvulnerable?: () => boolean;
}

export function createFellingSystem(opts: FellingOpts): FellingHandles {
  const { scene, trees, colliders } = opts;
  const logs: LogEntity[] = [];
  const stumps: StumpHandles[] = [];
  const chips = createWoodChips(scene);
  const lastChipAt = new Map<string, number>();

  function findTarget(playerPos: Vector3): TreeInstance | null {
    let best: TreeInstance | null = null;
    let bestDist = INTERACT_RANGE;
    for (const t of trees) {
      if (t.status !== "standing" && t.status !== "gnawing") continue;
      const d = Vector3.Distance(playerPos, t.position);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  function startFall(t: TreeInstance): void {
    t.status = "falling";
    t.fallTimer = 0;
    // Random horizontal fall direction. The dodge mechanic keeps the player
    // out of the trunk's path.
    const angle = Math.random() * Math.PI * 2;
    const dir = new Vector3(Math.cos(angle), 0, Math.sin(angle));
    t.fallDir = dir;
    // For the trunk's local +Y axis to rotate toward `dir` under
    // Quaternion.RotationAxis(fallAxis, +π/2), the axis must be Y × dir.
    // Y × dir = (1*dir.z - 0*0, 0*dir.x - 0*dir.z, 0*0 - 1*dir.x)
    //        = (dir.z, 0, -dir.x)
    t.fallAxis = new Vector3(dir.z, 0, -dir.x);
    if (opts.warning) opts.warning.show(t.id, t.position, dir, FALL_DURATION);
  }

  // Squash check: the falling trunk lies along `along` from base to tip.
  // We treat its swept rectangle (length TRUNK_LENGTH, half-width STRIKE_HALF_WIDTH)
  // as the danger zone. Once fall progress passes STRIKE_THRESHOLD_U, the trunk
  // is low enough to hit the player — fire onSquash if they're standing in it.
  const squashed = new Set<string>();
  function checkSquash(t: TreeInstance, u: number, player: PlayerHandles): void {
    if (squashed.has(t.id)) return;
    if (u < STRIKE_THRESHOLD_U) return;
    if (!t.fallDir) return;
    if (opts.isPlayerInvulnerable?.()) return;
    const dx = player.position.x - t.position.x;
    const dz = player.position.z - t.position.z;
    // Project player offset onto along (= fallDir) and perp (perpendicular to fallDir, CCW around Y).
    const sAlong = dx * t.fallDir.x + dz * t.fallDir.z;
    const sPerp = dx * (-t.fallDir.z) + dz * t.fallDir.x;
    if (sAlong < 0 || sAlong > TRUNK_LENGTH) return;
    if (Math.abs(sPerp) > STRIKE_HALF_WIDTH) return;
    squashed.add(t.id);
    opts.onSquash?.(t.id);
  }

  function update(dt: number, player: PlayerHandles): void {
    chips.update(dt);

    const target = findTarget(player.position);

    // Decay gnaw on any tree the player walked away from mid-gnaw.
    for (const t of trees) {
      if (t.status === "gnawing" && t !== target) {
        t.gnawProgress = Math.max(0, t.gnawProgress - dt * 0.6);
        if (t.gnawProgress <= 0) t.status = "standing";
      }
    }

    if (target && target.status !== "falling" && target.status !== "fallen") {
      if (player.state.interactHeld) {
        target.status = "gnawing";
        target.gnawProgress += dt / GNAW_TIME;

        const now = performance.now();
        const last = lastChipAt.get(target.id) ?? 0;
        if (now - last > CHIP_INTERVAL_S * 1000) {
          const trunkSide = player.position.subtract(target.position);
          trunkSide.y = 0;
          if (trunkSide.lengthSquared() > 1e-6) trunkSide.normalize();
          trunkSide.scaleInPlace(0.16 * target.scale);
          const bite = target.position.add(trunkSide);
          bite.y = target.position.y + 0.18 + Math.random() * 0.08;
          chips.emit(bite, 3);
          lastChipAt.set(target.id, now);
        }

        if (target.gnawProgress >= 1) {
          startFall(target);
          const burst = target.position.clone();
          burst.y += 0.25;
          chips.emit(burst, 8);
        }
      }
    }

    for (const t of trees) {
      if (t.status !== "falling" || !t.fallAxis) continue;
      t.fallTimer += dt;
      const u = Math.min(1, Math.max(0, t.fallTimer / FALL_DURATION));
      const eased = u * u;
      const angle = eased * (Math.PI / 2);
      // Babylon glTF loader sets rotationQuaternion on tree roots — Euler is
      // ignored. Overwrite the quaternion each frame.
      t.root.position.copyFrom(t.position);
      t.root.rotationQuaternion = Quaternion.RotationAxis(t.fallAxis, angle);

      checkSquash(t, u, player);

      if (u >= 1) {
        if (opts.warning) opts.warning.hide(t.id);
        t.status = "fallen";
        const dir = t.fallDir ?? new Vector3(1, 0, 0);
        const logPos = t.position.add(dir.scale(0.7));
        const logYaw = Math.atan2(dir.x, dir.z);
        logs.push(spawnLog(scene, logPos, logYaw));

        const stump = spawnStump(scene, t.position.clone(), t.scale);
        stumps.push(stump);

        if (colliders) {
          colliders.remove(t.id);
          colliders.add({
            id: `${t.id}-stump`,
            cx: t.position.x,
            cz: t.position.z,
            radius: stump.radius,
          });
        }

        t.root.setEnabled(false);
      }
    }
  }

  function destroy(): void {
    chips.destroy();
  }

  return { trees, logs, stumps, chips, update, destroy };
}
