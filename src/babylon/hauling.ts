import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { LogEntity } from "./log";
import type { PlayerHandles } from "./player";
import type { Terrain } from "./terrain";

// E to pick up the nearest grounded log within range; E again to drop.
// Carried log rides over the beaver's back, slowing the player on land
// (water-as-highway speeds them back up, once damming is wired).

const PICKUP_RANGE = 1.2;
const CARRY_OFFSET_FRONT = 0.45;    // metres forward of beaver center (held in mouth)
const CARRY_OFFSET_UP = 0.35;       // metres above ground (mouth height)
const CARRY_BOB_AMP = 0.025;
const LAND_SPEED_MULT = 0.7;
const WATER_SPEED_MULT = 1.4;
const WATER_LEVEL_THRESHOLD = -0.5; // y below water level by this counts as in-water

export interface HaulingHandles {
  carriedLog: LogEntity | null;
  speedMultiplier: number;
  update(dt: number, player: PlayerHandles, logs: LogEntity[]): void;
}

export interface HaulingOpts {
  terrain: Terrain;
  // Live water level. Damming drives this; default 0 means "no water".
  getWaterLevel: () => number;
}

export function createHaulingSystem(opts: HaulingOpts): HaulingHandles {
  const handles: HaulingHandles = {
    carriedLog: null,
    speedMultiplier: 1.0,
    update(dt, player, logs) {
      // Felling runs first in the tick (drains interactQueued for gnawing if a
      // standing tree is in range). If the flag survives to here, hauling
      // claims it for pickup/drop.
      const interact = player.state.interactQueued;
      if (interact) player.state.interactQueued = false;

      const playerY = player.position.y;
      const inWater = playerY < opts.getWaterLevel() + WATER_LEVEL_THRESHOLD;

      const yaw = player.yaw();
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);

      if (handles.carriedLog) {
        if (interact) {
          // Drop at player's feet, slightly forward
          const log = handles.carriedLog;
          const dropPos = new Vector3(
            player.position.x + fx * 0.5,
            opts.terrain.heightAt(player.position.x + fx * 0.5, player.position.z + fz * 0.5) + 0.10,
            player.position.z + fz * 0.5,
          );
          log.mesh.position.copyFrom(dropPos);
          log.mesh.rotation.set(0, yaw, Math.PI / 2);
          log.status = "ground";
          log.groundedPosition = dropPos.clone();
          handles.carriedLog = null;
        } else {
          // Carry in the mouth: slightly in front of beaver center, mouth-height.
          const target = new Vector3(
            player.position.x + fx * CARRY_OFFSET_FRONT,
            player.position.y + CARRY_OFFSET_UP + Math.sin(performance.now() * 0.008) * CARRY_BOB_AMP,
            player.position.z + fz * CARRY_OFFSET_FRONT,
          );
          // Smooth-follow so the log doesn't snap during sharp turns.
          const k = Math.min(1, dt * 12);
          handles.carriedLog.mesh.position.x += (target.x - handles.carriedLog.mesh.position.x) * k;
          handles.carriedLog.mesh.position.y += (target.y - handles.carriedLog.mesh.position.y) * k;
          handles.carriedLog.mesh.position.z += (target.z - handles.carriedLog.mesh.position.z) * k;
          // Log axis perpendicular to body so it lies across the back. Babylon's
          // Euler order is YXZ: Z=π/2 lays the cylinder horizontal, then Y=yaw
          // (no +π/2 offset — Babylon's order makes that anti-parallel, not
          // perpendicular) aligns the log with the cross(up, forward) axis.
          handles.carriedLog.mesh.rotation.set(0, yaw, Math.PI / 2);
        }
      } else if (interact) {
        // Try to pick up the nearest grounded log within range.
        let best: LogEntity | null = null;
        let bestDist = PICKUP_RANGE;
        for (const log of logs) {
          if (log.status !== "ground") continue;
          const d = Vector3.Distance(player.position, log.mesh.position);
          if (d < bestDist) {
            bestDist = d;
            best = log;
          }
        }
        if (best) {
          best.status = "carried";
          handles.carriedLog = best;
        }
      }

      let mult = 1.0;
      if (handles.carriedLog) mult *= LAND_SPEED_MULT;
      if (inWater) mult *= WATER_SPEED_MULT;
      handles.speedMultiplier = mult;
    },
  };
  return handles;
}
