import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";

// Procedural heightfield terrain — ported from src/scene/terrain.ts (Three.js).
// Same noise + creek-carve + dam-site detection. Mesh produced via Babylon
// VertexData; cozy palette via vertex-colors on StandardMaterial.

export interface TerrainOpts {
  size: number;
  segments: number;
  seed: number;
  amplitude: number;
}

const GRASS_DARK = new Color3(0.196, 0.298, 0.169); // #324c2b
const GRASS_MID = new Color3(0.239, 0.478, 0.239); // #3d7a3d
const GRASS_LIGHT = new Color3(0.525, 0.659, 0.380); // #86a861
const DIRT = new Color3(0.478, 0.353, 0.227); // #7a5a3a
const CREEK_BED = new Color3(0.365, 0.435, 0.329); // #5d6f54

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeValueNoise(seed: number) {
  const rand = mulberry32(seed);
  const LATTICE = 64;
  const grid: number[] = new Array(LATTICE * LATTICE);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const smoothstep = (t: number) => t * t * (3 - 2 * t);
  const at = (ix: number, iy: number) => {
    ix = ((ix % LATTICE) + LATTICE) % LATTICE;
    iy = ((iy % LATTICE) + LATTICE) % LATTICE;
    return grid[iy * LATTICE + ix]!;
  };
  return (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = smoothstep(x - ix);
    const fy = smoothstep(y - iy);
    const a = at(ix, iy);
    const b = at(ix + 1, iy);
    const c = at(ix, iy + 1);
    const d = at(ix + 1, iy + 1);
    return (
      a * (1 - fx) * (1 - fy) +
      b * fx * (1 - fy) +
      c * (1 - fx) * fy +
      d * fx * fy
    );
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp3(a: Color3, b: Color3, t: number, out: Color3): void {
  out.r = a.r + (b.r - a.r) * t;
  out.g = a.g + (b.g - a.g) * t;
  out.b = a.b + (b.b - a.b) * t;
}

export class Terrain {
  readonly mesh: Mesh;
  private heights: Float32Array;
  private size: number;
  private segments: number;
  readonly damSite: Vector3;
  readonly creekStart: Vector3;

  constructor(scene: Scene, opts: TerrainOpts) {
    this.size = opts.size;
    this.segments = opts.segments;
    const N = opts.segments + 1;
    this.heights = new Float32Array(N * N);

    const noise = makeValueNoise(opts.seed);
    const creekRand = mulberry32(opts.seed + 17);
    const meander = (x01: number) => {
      const a = Math.sin(x01 * Math.PI * 1.7 + creekRand()) * 0.18;
      const b = Math.sin(x01 * Math.PI * 4.2 + creekRand() * 6) * 0.06;
      return 0.5 + a + b;
    };

    let creekStart: Vector3 | null = null;
    let damSiteIx = -1;
    let damSiteIy = -1;
    let damSiteHeight = Infinity;

    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        const x01 = ix / opts.segments;
        const y01 = iy / opts.segments;

        let h = 0;
        let amp = 1;
        let freq = 2.0;
        let total = 0;
        for (let o = 0; o < 4; o++) {
          h += amp * noise(x01 * freq + 13.7, y01 * freq + 7.1);
          total += amp;
          amp *= 0.5;
          freq *= 2.0;
        }
        h /= total;

        const creekY = meander(x01);
        const distFromCreek = Math.abs(y01 - creekY);
        const creekRadius = 0.10;
        const inCreek = Math.max(0, 1 - distFromCreek / creekRadius);
        h -= inCreek * 0.55;

        const edge = Math.min(x01, 1 - x01, y01, 1 - y01);
        const edgeBlend = Math.min(1, edge / 0.12);
        h *= 0.4 + 0.6 * edgeBlend;

        const worldY = h * opts.amplitude;
        this.heights[iy * N + ix] = worldY;

        if (ix === N - 4 && inCreek > 0.6 && worldY < damSiteHeight) {
          damSiteHeight = worldY;
          damSiteIx = ix;
          damSiteIy = iy;
        }
        if (ix === 3 && inCreek > 0.6 && creekStart === null) {
          creekStart = new Vector3(this.gridToWorldX(ix), worldY, this.gridToWorldZ(iy));
        }
      }
    }

    // Build mesh via VertexData — Babylon's analog of Three.js BufferGeometry.
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const tmpColor = new Color3();

    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        const wx = this.gridToWorldX(ix);
        const wy = this.heights[iy * N + ix]!;
        const wz = this.gridToWorldZ(iy);
        positions.push(wx, wy, wz);

        const t = clamp01(wy / opts.amplitude);
        if (t < 0.18) tmpColor.copyFrom(CREEK_BED);
        else if (t < 0.4) lerp3(GRASS_DARK, GRASS_MID, (t - 0.18) / 0.22, tmpColor);
        else if (t < 0.75) lerp3(GRASS_MID, GRASS_LIGHT, (t - 0.4) / 0.35, tmpColor);
        else lerp3(GRASS_LIGHT, DIRT, (t - 0.75) / 0.25, tmpColor);
        colors.push(tmpColor.r, tmpColor.g, tmpColor.b, 1.0);
      }
    }

    for (let iy = 0; iy < opts.segments; iy++) {
      for (let ix = 0; ix < opts.segments; ix++) {
        const a = iy * N + ix;
        const b = a + 1;
        const c = a + N;
        const d = c + 1;
        // Two triangles per quad. Wind so the up-normal points +Y.
        indices.push(a, c, b, b, c, d);
      }
    }

    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);

    const mesh = new Mesh("terrain", scene);
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.applyToMesh(mesh);
    mesh.convertToFlatShadedMesh();
    mesh.useVertexColors = true;

    const mat = new StandardMaterial("terrain-mat", scene);
    mat.disableLighting = false;
    mat.specularColor = new Color3(0, 0, 0);
    mat.diffuseColor = new Color3(1, 1, 1);
    mesh.material = mat;
    mesh.receiveShadows = true;
    this.mesh = mesh;

    if (damSiteIx < 0) {
      damSiteIx = N - 4;
      damSiteIy = Math.floor(N / 2);
    }
    this.damSite = new Vector3(
      this.gridToWorldX(damSiteIx),
      this.heights[damSiteIy * N + damSiteIx]!,
      this.gridToWorldZ(damSiteIy),
    );
    this.creekStart = creekStart ?? new Vector3(-opts.size / 2 + 1, 0, 0);
  }

  private worldToGridX(x: number): number {
    return ((x + this.size / 2) / this.size) * this.segments;
  }
  private worldToGridZ(z: number): number {
    return ((z + this.size / 2) / this.size) * this.segments;
  }
  private gridToWorldX(ix: number): number {
    return -this.size / 2 + (ix / this.segments) * this.size;
  }
  private gridToWorldZ(iy: number): number {
    return -this.size / 2 + (iy / this.segments) * this.size;
  }

  heightAt(x: number, z: number): number {
    const fx = this.worldToGridX(x);
    const fz = this.worldToGridZ(z);
    const N = this.segments + 1;
    const ix = Math.max(0, Math.min(this.segments - 1, Math.floor(fx)));
    const iz = Math.max(0, Math.min(this.segments - 1, Math.floor(fz)));
    const tx = fx - ix;
    const tz = fz - iz;
    const a = this.heights[iz * N + ix]!;
    const b = this.heights[iz * N + ix + 1]!;
    const c = this.heights[(iz + 1) * N + ix]!;
    const d = this.heights[(iz + 1) * N + ix + 1]!;
    return a * (1 - tx) * (1 - tz) + b * tx * (1 - tz) + c * (1 - tx) * tz + d * tx * tz;
  }

  slopeAt(x: number, z: number): number {
    const eps = this.size / this.segments;
    const dy = this.heightAt(x, z + eps) - this.heightAt(x, z - eps);
    const dx = this.heightAt(x + eps, z) - this.heightAt(x - eps, z);
    const grad = Math.hypot(dx, dy) / (2 * eps);
    return Math.atan(grad);
  }

  get halfExtent(): number {
    return this.size / 2;
  }

  get worldOrigin(): Vector2 {
    return new Vector2(-this.size / 2, -this.size / 2);
  }

  get worldSize(): number {
    return this.size;
  }
}
