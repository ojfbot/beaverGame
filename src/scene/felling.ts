import * as THREE from "three";
import type { TreeState } from "./world";
import type { PlayerHandles } from "./player";
import { spawnLog, type LogEntity } from "./log";

const INTERACT_RANGE = 1.6;     // metres — how close you need to be to a tree
const GNAW_TIME = 2.6;          // seconds to fell (continuous E hold)
const FALL_DURATION = 1.0;      // seconds for the fall animation

export interface FellingHandles {
  trees: TreeState[];
  logs: LogEntity[];
  // Called every frame from the main tick.
  update(dt: number, player: PlayerHandles): void;
}

export function createFellingSystem(scene: THREE.Scene, trees: TreeState[]): FellingHandles {
  const logs: LogEntity[] = [];

  // Find nearest standing tree within INTERACT_RANGE of the player.
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

  function startFall(t: TreeState, player: PlayerHandles) {
    t.status = "falling";
    t.fallTimer = 0;
    // Fall AWAY from the player — beaver bites toward the trunk, the tree
    // pivots back over the bite. Fall axis is perpendicular to the player→tree
    // vector, in the horizontal plane, so the trunk topples in a stable arc.
    const away = new THREE.Vector3()
      .subVectors(t.position, player.position)
      .setY(0)
      .normalize();
    t.fallAxis = new THREE.Vector3(-away.z, 0, away.x); // 90° CCW
  }

  function darkenTrunk(group: THREE.Group, gnawProgress: number) {
    // Darken the trunk's vertex colours toward damage as gnaw progresses.
    // 0 = unchanged, 1 = quite dark. Visible feedback without UI.
    group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      // Heuristic: trunk is the smaller mesh in z-extent compared to foliage.
      // The foundry fixture names the trunk "trunk" — match by name.
      if (node.name !== "trunk") return;
      const colors = node.geometry.attributes.color as THREE.BufferAttribute | undefined;
      if (!colors) return;
      // Cache the original colours once; subsequent calls modulate from cache.
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
    const target = findTarget(player.position);

    // Reset gnaw progress on any tree that lost focus this frame
    for (const t of trees) {
      if (t.status === "gnawing" && t !== target) {
        // Gradual fade-back rather than hard reset — feels less punishing
        t.gnawProgress = Math.max(0, t.gnawProgress - dt * 0.6);
        if (t.gnawProgress <= 0) t.status = "standing";
        darkenTrunk(t.group, t.gnawProgress);
      }
    }

    if (target && target.status !== "falling" && target.status !== "fallen") {
      // E held? In M-β we treat E as a held verb for felling — repeating queue
      // events while held would also work, but holding feels right for gnaw.
      // We use a simple heuristic: while the interactQueued edge fires OR while
      // the player keeps re-queueing E, treat it as held. We just keep gnaw
      // progressing if any of WASD is held (player is near tree and engaged)
      // OR an interact was just queued.
      // Simpler: tick gnaw every frame the player is within range and pressed
      // E in the last second. We'll consume a "held" semantic by latching the
      // last interactQueued time. For v0, draining the queue → kicks 1.0s of
      // gnaw eligibility.
      const now = performance.now();
      if (player.state.interactQueued) {
        target.userData_lastInteract = now;
        player.state.interactQueued = false;
      }
      const recentlyInteracted = (target.userData_lastInteract ?? 0) > now - 1000;
      if (recentlyInteracted) {
        target.status = "gnawing";
        target.gnawProgress += dt / GNAW_TIME;
        darkenTrunk(target.group, target.gnawProgress);
        if (target.gnawProgress >= 1) {
          startFall(target, player);
        }
      }
    }

    // Advance falls
    for (const t of trees) {
      if (t.status !== "falling" || !t.fallAxis) continue;
      t.fallTimer += dt;
      const u = THREE.MathUtils.clamp(t.fallTimer / FALL_DURATION, 0, 1);
      // Ease-in: starts slow, accelerates — the classic timber drop
      const eased = u * u;
      const angle = eased * (Math.PI / 2);
      // Rotate the whole group around the trunk base + along fallAxis
      t.group.position.copy(t.position); // anchor at base
      t.group.setRotationFromAxisAngle(t.fallAxis, angle);
      if (u >= 1) {
        t.status = "fallen";
        // Spawn one log at the fall direction. The fallen trunk lies along
        // the perpendicular of the fallAxis, in the +Y horizontal plane.
        const along = new THREE.Vector3(t.fallAxis.z, 0, -t.fallAxis.x); // 90° CW from axis
        const logPos = t.position.clone().addScaledVector(along, 0.7);
        const log = spawnLog(scene, logPos, Math.atan2(along.x, along.z));
        logs.push(log);
        // Fade the felled tree group: it's the visual stump+downed-trunk;
        // we keep it in the scene so the world reads as "this happened" but
        // mark it dead.
      }
    }
  }

  return { trees, logs, update };
}

// TreeState gets one undocumented userData field; type-loosely augment.
declare module "./world" {
  interface TreeState {
    userData_lastInteract?: number;
  }
}
