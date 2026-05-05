import type { Terrain } from "../terrain";
import type { PlayerHandles } from "../player";

// Minimap — top-right Canvas2D panel. Stripped Sprint 1 version: terrain
// shading + player triangle + static tree dots. Water polygon, logs, dam
// site, fallen-tree state come back when felling/hauling/damming/hydrology
// land in Sprints 2–3.

const SIZE = 180;

export interface MinimapHandles {
  el: HTMLDivElement;
  canvas: HTMLCanvasElement;
  update(): void;
  destroy(): void;
}

export interface MinimapOpts {
  parent: HTMLElement;
  terrain: Terrain;
  player: PlayerHandles;
  treePositions: { x: number; z: number }[];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function createMinimap(opts: MinimapOpts): MinimapHandles {
  const { terrain, player, treePositions } = opts;
  const worldSize = terrain.worldSize;

  const el = document.createElement("div");
  el.id = "ui-minimap";
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  el.appendChild(canvas);
  opts.parent.appendChild(el);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ui: 2d canvas unavailable");

  // Bake the terrain layer once.
  const baseImage = ctx.createImageData(SIZE, SIZE);
  const baseData = baseImage.data;
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
      const t = clamp01((h - minH) / range);
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

  function worldToPixel(x: number, z: number): { px: number; py: number } {
    return {
      px: ((x / worldSize) + 0.5) * SIZE,
      py: ((z / worldSize) + 0.5) * SIZE,
    };
  }

  function update(): void {
    if (!ctx) return;
    ctx.putImageData(baseImage, 0, 0);

    // Trees (Sprint 1: all standing; felled/log states arrive in Sprint 2).
    for (const t of treePositions) {
      const { px, py } = worldToPixel(t.x, t.z);
      ctx.fillStyle = "#2d5d2a";
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player triangle.
    const { px, py } = worldToPixel(player.position.x, player.position.z);
    const yaw = player.yaw();
    const fx = -Math.sin(yaw);
    const fy = -Math.cos(yaw);
    // Right-vector = forward rotated 90° CW in 2D.
    const rx = -fy;
    const ry = fx;
    ctx.fillStyle = "#a64a1f";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + fx * 5, py + fy * 5);
    ctx.lineTo(px - fx * 2.5 + rx * 3.5, py - fy * 2.5 + ry * 3.5);
    ctx.lineTo(px - fx * 2.5 - rx * 3.5, py - fy * 2.5 - ry * 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function destroy(): void {
    el.remove();
  }

  return { el, canvas, update, destroy };
}
