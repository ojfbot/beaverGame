import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import type { TreeInstance } from "./world";
import type { PlayerHandles } from "./player";
import type { ColliderRegistry } from "./collision";
import { spawnLog, type LogEntity } from "./log";
import { spawnStump, type StumpHandles } from "./stump";
import { createWoodChips, type ChipsHandles } from "./particles";

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

  function startFall(t: TreeInstance, player: PlayerHandles): void {
    t.status = "falling";
    t.fallTimer = 0;
    // Default: tree falls AWAY from the player along the player→tree axis.
    // Random direction + warning + dodge mechanic land in the dodge-gameplay
    // PR — until then the trunk consistently lands on the far side, so the
    // player never gets clobbered by their own gnaw.
    const dir = t.position.subtract(player.position);
    dir.y = 0;
    if (dir.lengthSquared() < 1e-6) dir.set(1, 0, 0);
    dir.normalize();
    // Y × dir so Quaternion.RotationAxis(fallAxis, +π/2) tips the trunk's
    // local +Y onto +dir. Without this sign, Babylon's LH rotation conv.
    // sends the trunk to -dir.
    t.fallAxis = new Vector3(dir.z, 0, -dir.x);
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
          startFall(target, player);
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

      if (u >= 1) {
        t.status = "fallen";
        // Inverse of fallAxis = Y × dir: dir = -Y × fallAxis = (-fallAxis.z, 0, fallAxis.x)
        const dir = new Vector3(-t.fallAxis.z, 0, t.fallAxis.x);
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
