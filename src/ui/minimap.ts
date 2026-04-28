import * as THREE from "three";
import type { WorldHandles } from "../scene/world";
import type { PlayerHandles } from "../scene/player";
import type { FellingHandles } from "../scene/felling";
import type { DammingHandles } from "../scene/damming";

// Minimap — top-right Canvas2D panel. Bakes the terrain heightmap once at
// init (sampled across a SIZE×SIZE grid via terrain.heightAt), then redraws
// the dynamic layers per frame: water polygon, tree/log dots, dam stake,
// player triangle.
//
// World↔pixel: the terrain spans `terrain.worldSize` square, centred at
// origin. Pixel (px, py) ↔ world (worldX, worldZ) via:
//   worldX = (px / SIZE - 0.5) * worldSize
//   worldZ = (py / SIZE - 0.5) * worldSize
// (And the inverse to plot entities.)

const SIZE = 180; // physical canvas resolution (matches CSS panel size)

export interface MinimapHandles {
  el: HTMLDivElement;
  canvas: HTMLCanvasElement;
  update(): void;
  destroy(): void;
}

export function createMinimap(opts: {
  parent: HTMLElement;
  world: WorldHandles;
  player: PlayerHandles;
  felling: FellingHandles;
  damming: DammingHandles;
}): MinimapHandles {
  const { world, player, felling, damming } = opts;
  const terrain = world.terrain;
  const worldSize = terrain.worldSize;

  // Build the panel + canvas
  const el = document.createElement("div");
  el.id = "ui-minimap";
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  el.appendChild(canvas);
  opts.parent.appendChild(el);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ui: 2d canvas unavailable");

  // ── Bake the terrain layer once (height-shaded ImageData) ──────────────
  const baseImage = ctx.createImageData(SIZE, SIZE);
  const baseData = baseImage.data;
  // Normalise heights for shading. Probe the corner + middle samples so we
  // can lift the gradient mid-tones to be readable.
  let maxH = 0;
  let minH = Infinity;
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const wx = (px / SIZE - 0.5) * worldSize;
      const wz = (py / SIZE - 0.5) * worldSize;
      const h = terrain.heightAt(wx, wz);
      if (h > maxH) maxH = h;
      if (h < minH) minH = h;
    }
  }
  const range = Math.max(0.01, maxH - minH);
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const wx = (px / SIZE - 0.5) * worldSize;
      const wz = (py / SIZE - 0.5) * worldSize;
      const h = terrain.heightAt(wx, wz);
      const t = THREE.MathUtils.clamp((h - minH) / range, 0, 1);
      // Three-stop gradient: creek bed (slate-green) → meadow → highland dirt
      let r: number, g: number, b: number;
      if (t < 0.4) {
        const u = t / 0.4;
        r = lerp(82, 76, u); g = lerp(102, 138, u); b = lerp(76, 82, u);
      } else if (t < 0.78) {
        const u = (t - 0.4) / 0.38;
        r = lerp(76, 142, u); g = lerp(138, 176, u); b = lerp(82, 92, u);
      } else {
        const u = (t - 0.78) / 0.22;
        r = lerp(142, 168, u); g = lerp(176, 144, u); b = lerp(92, 80, u);
      }
      const i = (py * SIZE + px) * 4;
      baseData[i + 0] = r;
      baseData[i + 1] = g;
      baseData[i + 2] = b;
      baseData[i + 3] = 255;
    }
  }

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  // World→pixel for entity overlays
  function worldToPixel(x: number, z: number): { px: number; py: number } {
    return {
      px: ((x / worldSize) + 0.5) * SIZE,
      py: ((z / worldSize) + 0.5) * SIZE,
    };
  }

  // ── Per-frame redraw ──────────────────────────────────────────────────
  function update(): void {
    if (!ctx) return;

    // 1. Base terrain
    ctx.putImageData(baseImage, 0, 0);

    // 2. Water polygon — overlay slate-blue wherever terrain is below the
    //    water level. Re-sample the heightmap (cheap, 180² cells, 32k ops).
    if (damming.waterLevel > -10) {
      const waterImage = ctx.getImageData(0, 0, SIZE, SIZE);
      const wd = waterImage.data;
      for (let py = 0; py < SIZE; py++) {
        for (let px = 0; px < SIZE; px++) {
          const wx = (px / SIZE - 0.5) * worldSize;
          const wz = (py / SIZE - 0.5) * worldSize;
          const h = terrain.heightAt(wx, wz);
          if (h < damming.waterLevel - 0.01) {
            const depth = THREE.MathUtils.clamp((damming.waterLevel - h) * 0.45, 0, 1);
            const i = (py * SIZE + px) * 4;
            // Blue-tinted blend: keep some terrain colour for shallow areas
            const a = 0.42 + 0.4 * depth;
            wd[i + 0] = wd[i + 0]! * (1 - a) + 90 * a;
            wd[i + 1] = wd[i + 1]! * (1 - a) + 138 * a;
            wd[i + 2] = wd[i + 2]! * (1 - a) + 168 * a;
          }
        }
      }
      ctx.putImageData(waterImage, 0, 0);
    }

    // 3. Trees
    for (const t of world.treeStates) {
      const { px, py } = worldToPixel(t.position.x, t.position.z);
      ctx.fillStyle = t.status === "fallen" ? "#6b5236" : "#2d5d2a";
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Logs
    for (const log of felling.logs) {
      const { px, py } = worldToPixel(log.mesh.position.x, log.mesh.position.z);
      ctx.fillStyle =
        log.status === "placed" ? "#c9a55c" :
        log.status === "carried" ? "#e2bd6a" : "#8b6a3e";
      ctx.beginPath();
      ctx.arc(px, py, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Dam site (ring) + stack mass at the dam
    {
      const { px, py } = worldToPixel(damming.damSite.x, damming.damSite.z);
      ctx.strokeStyle = "rgba(166, 74, 31, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 5.5, 0, Math.PI * 2);
      ctx.stroke();
      if (damming.damLogs.length > 0) {
        ctx.fillStyle = "rgba(166, 74, 31, 0.9)";
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Player — small filled triangle pointing along facing
    {
      const { px, py } = worldToPixel(player.position.x, player.position.z);
      const yaw = player.group.rotation.y;
      // Beaver yaw=0 faces -Z in world → in minimap, "up" on screen
      const f = new THREE.Vector2(-Math.sin(yaw), -Math.cos(yaw));
      const r = f.clone().rotateAround(new THREE.Vector2(0, 0), Math.PI / 2);
      ctx.fillStyle = "#a64a1f";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + f.x * 5, py + f.y * 5);
      ctx.lineTo(px - f.x * 2.5 + r.x * 3.5, py - f.y * 2.5 + r.y * 3.5);
      ctx.lineTo(px - f.x * 2.5 - r.x * 3.5, py - f.y * 2.5 - r.y * 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function destroy(): void {
    el.remove();
  }

  return { el, canvas, update, destroy };
}
