import * as THREE from "three";

// Procedural heightfield terrain. Seeded value noise (no Perlin libs), built
// once at world load. Vertex colours grade from grass to dirt by height; the
// mesh exposes height + slope sample functions so the player + scatter can
// query terrain.
//
// Why not the foundry's ground_pond_meadow.glb? That asset is a flat patch
// for Phase 0. Mode A wants a creek bed leading to a flow point, which only
// reads if the terrain has real elevation. Procedural is the right register
// for "small specific place" — runtime-generated noise, not a pre-baked mesh.

export interface TerrainOpts {
  size: number;     // world-units across (square)
  segments: number; // grid resolution
  seed: number;
  // Rough amplitude of vertical relief — the world's tallest hill above the
  // lowest creek-bed point.
  amplitude: number;
}

const GRASS_DARK = new THREE.Color("#324c2b");
const GRASS_MID = new THREE.Color("#3d7a3d");
const GRASS_LIGHT = new THREE.Color("#86a861");
const DIRT = new THREE.Color("#7a5a3a");
const CREEK_BED = new THREE.Color("#5d6f54");

// Mulberry32 — tiny deterministic PRNG, seeded.
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

// 2D value noise built on a coarse lattice + smoothstep interpolation. Cheap,
// deterministic, no external deps. Octaves stack for detail.
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

export class Terrain {
  readonly group = new THREE.Group();
  private heights: Float32Array; // (segments+1) x (segments+1)
  private size: number;
  private segments: number;
  private mesh: THREE.Mesh;

  // Where the dam site is. Computed once during build by finding the lowest
  // east-edge column of the creek bed (the "outflow"). Used by M-δ.
  readonly damSite: THREE.Vector3;
  readonly creekStart: THREE.Vector3;

  constructor(opts: TerrainOpts) {
    this.size = opts.size;
    this.segments = opts.segments;
    const N = opts.segments + 1;
    this.heights = new Float32Array(N * N);

    const noise = makeValueNoise(opts.seed);

    // Carve a creek bed running roughly W → E. We add a "ridge" function that
    // pushes height down along a meandering centre-line.
    const creekRand = mulberry32(opts.seed + 17);
    const meander = (x01: number) => {
      // x01 in [0,1] across the terrain; output is creek-Y normalised
      const a = Math.sin(x01 * Math.PI * 1.7 + creekRand()) * 0.18;
      const b = Math.sin(x01 * Math.PI * 4.2 + creekRand() * 6) * 0.06;
      return 0.5 + a + b;
    };

    let creekStart: THREE.Vector3 | null = null;
    let damSiteIx = -1;
    let damSiteIy = -1;
    let damSiteHeight = Infinity;

    // Build heights
    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        const x01 = ix / opts.segments;
        const y01 = iy / opts.segments;

        // Multi-octave value noise, 0..1
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
        h /= total; // normalise to ~[0,1]

        // Carve creek
        const creekY = meander(x01);
        const distFromCreek = Math.abs(y01 - creekY);
        const creekRadius = 0.10;
        const inCreek = Math.max(0, 1 - distFromCreek / creekRadius);
        // Lower the creek bed by up to 0.55 of full amplitude
        h -= inCreek * 0.55;

        // Soft falloff at the patch edge so the world reads as an island
        const edge = Math.min(x01, 1 - x01, y01, 1 - y01);
        const edgeBlend = Math.min(1, edge / 0.12);
        h *= 0.4 + 0.6 * edgeBlend;

        const worldY = h * opts.amplitude;
        this.heights[iy * N + ix] = worldY;

        // Track dam site at the eastern outflow (the creek as it leaves the patch)
        if (ix === N - 4 && inCreek > 0.6 && worldY < damSiteHeight) {
          damSiteHeight = worldY;
          damSiteIx = ix;
          damSiteIy = iy;
        }
        if (ix === 3 && inCreek > 0.6 && creekStart === null) {
          creekStart = new THREE.Vector3(this.gridToWorldX(ix), worldY, this.gridToWorldZ(iy));
        }
      }
    }

    // Build the mesh
    const geom = new THREE.PlaneGeometry(opts.size, opts.size, opts.segments, opts.segments);
    geom.rotateX(-Math.PI / 2); // lie flat in XZ; height goes into Y

    const positions = geom.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const ix = i % N;
      const iy = Math.floor(i / N);
      const y = this.heights[iy * N + ix]!;
      positions.setY(i, y);

      // Vertex colour by height + slope
      const t = THREE.MathUtils.clamp(y / opts.amplitude, 0, 1);
      const c = new THREE.Color();
      if (t < 0.18) c.copy(CREEK_BED);
      else if (t < 0.4) c.copy(GRASS_DARK).lerp(GRASS_MID, (t - 0.18) / 0.22);
      else if (t < 0.75) c.copy(GRASS_MID).lerp(GRASS_LIGHT, (t - 0.4) / 0.35);
      else c.copy(GRASS_LIGHT).lerp(DIRT, (t - 0.75) / 0.25);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geom, material);
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    // Dam site fallback if the loop didn't find one
    if (damSiteIx < 0) {
      damSiteIx = N - 4;
      damSiteIy = Math.floor(N / 2);
    }
    this.damSite = new THREE.Vector3(
      this.gridToWorldX(damSiteIx),
      this.heights[damSiteIy * N + damSiteIx]!,
      this.gridToWorldZ(damSiteIy)
    );
    this.creekStart = creekStart ?? new THREE.Vector3(-opts.size / 2 + 1, 0, 0);
  }

  // World coords → grid index (returns fractional indices for bilerp).
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

  // Sample the heightfield on the actual triangle the point lies in, matching
  // THREE.PlaneGeometry's per-cell triangulation. Using a bilinear blend here
  // pulls the player below the visible flat-shaded surface in concave cells
  // (the dug-out areas) — barycentric on the same diagonal Three.js
  // tessellates with keeps the player on the visible plane.
  heightAt(x: number, z: number): number {
    const fx = this.worldToGridX(x);
    const fz = this.worldToGridZ(z);
    const N = this.segments + 1;
    const ix = THREE.MathUtils.clamp(Math.floor(fx), 0, this.segments - 1);
    const iz = THREE.MathUtils.clamp(Math.floor(fz), 0, this.segments - 1);
    const tx = THREE.MathUtils.clamp(fx - ix, 0, 1);
    const tz = THREE.MathUtils.clamp(fz - iz, 0, 1);
    const a = this.heights[iz * N + ix]!;             // (0,0)
    const b = this.heights[iz * N + ix + 1]!;         // (1,0)
    const c = this.heights[(iz + 1) * N + ix]!;       // (0,1)
    const d = this.heights[(iz + 1) * N + ix + 1]!;   // (1,1)
    // PlaneGeometry splits each cell along the b→c diagonal (tx + tz = 1).
    // T1 (a,b,c) covers tx + tz < 1; T2 (b,c,d) covers tx + tz ≥ 1.
    if (tx + tz < 1) {
      return a + (b - a) * tx + (c - a) * tz;
    }
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }

  // Approximate slope (rad) at world XZ via central differences.
  slopeAt(x: number, z: number): number {
    const eps = this.size / this.segments;
    const dy = this.heightAt(x, z + eps) - this.heightAt(x, z - eps);
    const dx = this.heightAt(x + eps, z) - this.heightAt(x - eps, z);
    const grad = Math.hypot(dx, dy) / (2 * eps);
    return Math.atan(grad);
  }

  // Half-extent of the patch (for bounds clamping the player).
  get halfExtent(): number {
    return this.size / 2;
  }

  // Build a Float DataTexture of the heightfield for shader sampling. R
  // channel = world-space Y at that grid cell. Used by the damming water
  // shader to clip flood fragments where terrain rises above water level.
  toHeightTexture(): THREE.DataTexture {
    const N = this.segments + 1;
    const tex = new THREE.DataTexture(this.heights, N, N, THREE.RedFormat, THREE.FloatType);
    tex.needsUpdate = true;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  // Origin (XZ) of the heightfield in world coords (the corner of the patch).
  get worldOrigin(): THREE.Vector2 {
    return new THREE.Vector2(-this.size / 2, -this.size / 2);
  }

  get worldSize(): number {
    return this.size;
  }
}
