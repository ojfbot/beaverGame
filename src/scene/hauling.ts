import * as THREE from "three";
import { LOG_COLLIDER_RADIUS, type LogEntity } from "./log";
import type { PlayerHandles } from "./player";
import type { Terrain } from "./terrain";
import type { ColliderRegistry } from "./collision";

const PICKUP_RANGE = 1.2;       // how close to a log to pick it up
// Carry over the beaver's centre at chest/back height. The cylinder is laid
// perpendicular to facing, so its half-length protrudes past the silhouette
// on each side — visible from a third-person camera behind the beaver.
const CARRY_OFFSET_LOCAL = new THREE.Vector3(0, 0.55, 0);
const CARRY_BOB_AMP = 0.025;
const LAND_SPEED_MULT = 0.7;    // slower while carrying on land
const WATER_SPEED_MULT = 1.4;   // faster while in water — "water as highway"
const WATER_LEVEL_THRESHOLD = -0.5; // y below this counts as in water (M-δ updates this dynamically)

export interface HaulingHandles {
  carriedLog: LogEntity | null;
  // Speed multiplier the player should apply this frame. 1.0 if neither
  // carrying nor in water; M-γ blends carry + water.
  speedMultiplier: number;
  update(dt: number, player: PlayerHandles, logs: LogEntity[]): void;
}

export interface HaulingOpts {
  terrain: Terrain;
  // Live water level; M-δ drives this from dam state. M-γ defaults to a
  // very low value (effectively "no water") so the system works in isolation.
  getWaterLevel: () => number;
  // When provided, ground/dropped logs are registered so the player can't
  // walk through them; pickup deregisters.
  colliders?: ColliderRegistry;
}

export function createHaulingSystem(opts: HaulingOpts): HaulingHandles {
  const handles: HaulingHandles = {
    carriedLog: null,
    speedMultiplier: 1.0,
    update(dt, player, logs) {
      // Drain interactQueued — but only consume it if there's an interaction
      // available (otherwise leave for felling.update which runs after).
      // Actually felling.update runs first in the tick (we wired that order
      // in main.ts). It already drains interact for gnawing. So if interact
      // is still queued here, felling didn't claim it — which means the
      // player isn't near a standing tree. Free to repurpose for hauling.
      const interact = player.state.interactQueued;
      if (interact) player.state.interactQueued = false;

      const playerY = player.position.y;
      const waterLevel = opts.getWaterLevel();
      const inWater = playerY < waterLevel + WATER_LEVEL_THRESHOLD;

      if (handles.carriedLog) {
        // Drop on E
        if (interact) {
          const log = handles.carriedLog;
          // Drop at player's feet, slightly forward
          const f = player.forward();
          const dropPos = player.position.clone().addScaledVector(f, 0.5);
          dropPos.y = opts.terrain.heightAt(dropPos.x, dropPos.z) + 0.10;
          log.mesh.position.copy(dropPos);
          log.mesh.rotation.set(0, player.group.rotation.y, Math.PI / 2);
          log.status = "ground";
          log.groundedPosition = dropPos.clone();
          // Re-register the collider at the new ground location.
          opts.colliders?.add({
            id: log.id,
            cx: dropPos.x,
            cz: dropPos.z,
            radius: LOG_COLLIDER_RADIUS,
          });
          handles.carriedLog = null;
        } else {
          // Follow the player at hip height behind their head
          const offset = CARRY_OFFSET_LOCAL.clone().applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            player.group.rotation.y
          );
          const target = player.position.clone().add(offset);
          target.y += Math.sin(performance.now() * 0.008) * CARRY_BOB_AMP;
          handles.carriedLog.mesh.position.lerp(target, Math.min(1, dt * 12));
          // Long axis perpendicular to facing (sticks out of the beaver's
          // sides). rotation.z = π/2 lays the cylinder along world-X; Ry by
          // the player's yaw spins that into beaver-local-X. Adding +π/2
          // would put it along forward — that's the bug we just fixed.
          handles.carriedLog.mesh.rotation.y = player.group.rotation.y;
          handles.carriedLog.mesh.rotation.z = Math.PI / 2;
        }
      } else if (interact) {
        // Try to pick up the nearest grounded log within range
        let best: LogEntity | null = null;
        let bestDist = PICKUP_RANGE;
        for (const log of logs) {
          if (log.status !== "ground") continue;
          const d = player.position.distanceTo(log.mesh.position);
          if (d < bestDist) {
            bestDist = d;
            best = log;
          }
        }
        if (best) {
          best.status = "carried";
          // Carried logs travel with the player — the collider would chase
          // the beaver and shove them around. Drop it from the registry until
          // the log is dropped or placed.
          opts.colliders?.remove(best.id);
          handles.carriedLog = best;
        }
      }

      // Compute speed multiplier
      let mult = 1.0;
      if (handles.carriedLog) mult *= LAND_SPEED_MULT;
      if (inWater) mult *= WATER_SPEED_MULT;
      handles.speedMultiplier = mult;
    },
  };
  return handles;
}
