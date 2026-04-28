import * as THREE from "three";
import type { TreeState } from "./world";
import type { PlayerHandles } from "./player";
import type { ColliderRegistry } from "./collision";
import { spawnLog, type LogEntity } from "./log";
import { createWoodChips, type ChipsHandles } from "./particles";
import { spawnStump, type StumpHandles } from "./stump";

const INTERACT_RANGE = 1.6;     // metres — how close you need to be to a tree
const GNAW_TIME = 2.6;          // seconds of held-E to fell
const FALL_DURATION = 1.0;      // seconds for the fall animation
const CHIP_INTERVAL_S = 0.18;   // emit a burst of wood chips every N seconds while gnawing

export interface FellingHandles {
  trees: TreeState[];
  logs: LogEntity[];
  stumps: StumpHandles[];
  chips: ChipsHandles;
  update(dt: number, player: PlayerHandles): void;
  destroy(): void;
}

export interface FellingOpts {
  scene: THREE.Scene;
  trees: TreeState[];
  // Optional — when provided, felling swaps the trunk collider for a stump
  // collider on fall, so the player can't walk through the trunk while
  // standing AND can't walk through the stump after.
  colliders?: ColliderRegistry;
}

export function createFellingSystem(opts: FellingOpts): FellingHandles {
  const { scene, trees, colliders } = opts;
  const logs: LogEntity[] = [];
  const stumps: StumpHandles[] = [];
  const chips = createWoodChips(scene);

  // Per-tree last-chip-emission timestamps for frame-rate-independent pacing.
  const lastChipAt = new Map<string, number>();

  function findTarget(playerPos: THREE.Vector3): TreeState | null {
    let best: TreeState | null = null;
    let bestDist = INTERACT_RANGE;
    for (const t of trees) {
      if (t.status !== "standing" && t.status !== "gnawing") continue;
      const d = playerPos.distanceTo(t.position);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  function startFall(t: TreeState, player: PlayerHandles): void {
    t.status = "falling";
    t.fallTimer = 0;
    const away = new THREE.Vector3()
      .subVectors(t.position, player.position)
      .setY(0)
      .normalize();
    t.fallAxis = new THREE.Vector3(-away.z, 0, away.x); // 90° CCW
  }

  function darkenTrunk(group: THREE.Group, gnawProgress: number): void {
    group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.name !== "trunk") return;
      const colors = node.geometry.attributes.color as THREE.BufferAttribute | undefined;
      if (!colors) return;
      const cache = (node.userData.origColors ??= colors.array.slice()) as Float32Array;
      const t = THREE.MathUtils.clamp(gnawProgress, 0, 1);
      const darken = 1 - 0.55 * t;
      for (let i = 0; i < colors.count; i++) {
        colors.setX(i, cache[i * 3]! * darken);
        colors.setY(i, cache[i * 3 + 1]! * darken);
        colors.setZ(i, cache[i * 3 + 2]! * darken);
      }
      colors.needsUpdate = true;
    });
  }

  function update(dt: number, player: PlayerHandles): void {
    chips.update(dt);

    const target = findTarget(player.position);

    // Fade gnaw progress on any tree that isn't the active target this frame.
    for (const t of trees) {
      if (t.status === "gnawing" && t !== target) {
        t.gnawProgress = Math.max(0, t.gnawProgress - dt * 0.6);
        if (t.gnawProgress <= 0) t.status = "standing";
        darkenTrunk(t.group, t.gnawProgress);
      }
    }

    if (target && target.status !== "falling" && target.status !== "fallen") {
      // Held-E gnaw: while E is held and the player stands within range, gnaw
      // accumulates continuously. (Edge-triggered E still flows through to
      // hauling for pickup/drop — the held flag is independent.)
      if (player.state.interactHeld) {
        target.status = "gnawing";
        target.gnawProgress += dt / GNAW_TIME;
        darkenTrunk(target.group, target.gnawProgress);

        // Wood-chip puffs at the bite point — slightly above the trunk base,
        // on the side facing the player (so chips fly away from the bite).
        const now = performance.now();
        const last = lastChipAt.get(target.id) ?? 0;
        if (now - last > CHIP_INTERVAL_S * 1000) {
          const trunkSide = new THREE.Vector3()
            .subVectors(player.position, target.position)
            .setY(0)
            .normalize()
            .multiplyScalar(0.16 * target.group.scale.x);
          const bite = target.position.clone().add(trunkSide);
          bite.y = target.position.y + 0.18 + Math.random() * 0.08;
          chips.emit(bite, 3);
          lastChipAt.set(target.id, now);
        }

        if (target.gnawProgress >= 1) {
          startFall(target, player);
          // Triumphant final burst
          const burst = target.position.clone();
          burst.y += 0.25;
          chips.emit(burst, 8);
        }
      }
    }

    // Advance falls
    for (const t of trees) {
      if (t.status !== "falling" || !t.fallAxis) continue;
      t.fallTimer += dt;
      const u = THREE.MathUtils.clamp(t.fallTimer / FALL_DURATION, 0, 1);
      const eased = u * u;
      const angle = eased * (Math.PI / 2);
      t.group.position.copy(t.position);
      t.group.setRotationFromAxisAngle(t.fallAxis, angle);

      if (u >= 1) {
        t.status = "fallen";
        // Spawn a log along the fall direction.
        const along = new THREE.Vector3(t.fallAxis.z, 0, -t.fallAxis.x);
        const logPos = t.position.clone().addScaledVector(along, 0.7);
        const log = spawnLog(scene, logPos, Math.atan2(along.x, along.z));
        logs.push(log);

        // Stump at the base — left behind so the player can see what they cut.
        const scale = t.group.scale.x;
        const stumpPos = t.position.clone();
        const stump = spawnStump(scene, stumpPos, scale);
        stumps.push(stump);

        // Swap collider: trunk → stump (smaller radius).
        if (colliders) {
          colliders.remove(t.id);
          colliders.add({
            id: `${t.id}-stump`,
            cx: stumpPos.x,
            cz: stumpPos.z,
            radius: stump.radius,
          });
        }

        // Hide the fallen-tree group — the stump + log read more clearly
        // than a horizontal trunk + foliage tangled on the ground.
        t.group.visible = false;
      }
    }
  }

  function destroy(): void {
    chips.destroy();
  }

  return { trees, logs, stumps, chips, update, destroy };
}
