import * as THREE from "three";
import type { LogEntity } from "./log";
import type { PlayerHandles } from "./player";
import type { Terrain } from "./terrain";
import type { HaulingHandles } from "./hauling";

const DAM_SITE_RADIUS = 1.4;       // metres — drop within this to contribute
const WATER_RISE_PER_LOG = 0.35;   // each log raises the water level by this
const WATER_RISE_LERP = 1.6;       // smoothing on rise toward target (per second)

export interface DammingHandles {
  damSite: THREE.Vector3;
  marker: THREE.Group;
  damLogs: LogEntity[];           // logs that have been committed to the dam
  // Live water level (Y in world coords). Hauling reads this for the in-water
  // speed bonus; the water plane reads it for its own Y.
  waterLevel: number;
  // The water mesh is owned here so M-δ can update its position + opacity.
  waterPlane: THREE.Mesh;
  update(dt: number, player: PlayerHandles, hauling: HaulingHandles, allLogs: LogEntity[]): void;
}

export interface DammingOpts {
  scene: THREE.Scene;
  terrain: Terrain;
  // Where the dam goes — Terrain.damSite is the precomputed flow point.
  damSite: THREE.Vector3;
  // Surface area of the eventual pond — drives the water-plane size. We use
  // the terrain's footprint so the plane covers everywhere; the depth fade
  // hides it where the terrain is above water.
  worldSize: number;
}

function buildDamMarker(damSite: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(damSite);

  // A pair of stakes flanking the flow point — visible affordance, very
  // low-poly. The player learns "this is where dams go" without UI.
  const stakeGeom = new THREE.ConeGeometry(0.06, 0.7, 5);
  const stakeMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color("#a37e58"),
    flatShading: true,
  });
  for (const x of [-0.6, 0.6]) {
    const stake = new THREE.Mesh(stakeGeom, stakeMat);
    stake.position.set(x, 0.4, 0);
    stake.rotation.z = (x < 0 ? -1 : 1) * 0.15;
    group.add(stake);
  }

  // A faint disc at ground level marks the radius of contribution.
  const ringGeom = new THREE.RingGeometry(DAM_SITE_RADIUS - 0.08, DAM_SITE_RADIUS, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#d8e4d2"),
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);

  return group;
}

function buildWaterPlane(
  worldSize: number,
  heightTex: THREE.DataTexture,
  worldOrigin: THREE.Vector2
): THREE.Mesh {
  const geom = new THREE.PlaneGeometry(worldSize, worldSize, 32, 32);
  geom.rotateX(-Math.PI / 2);

  // Stylized water: shallow→deep tint by depth, sampled terrain heightmap
  // discards fragments where the ground rises above water (so the flood is
  // contained by topography).
  const material = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
      waterLevel: { value: 0 },
      heightTex: { value: heightTex },
      worldOrigin: { value: worldOrigin },
      worldSize: { value: worldSize },
      shallowColor: { value: new THREE.Color("#bce0d8") },
      deepColor: { value: new THREE.Color("#5a8aa0") },
    },
    vertexShader: /* glsl */ `
      uniform float time;
      varying vec3 vWorldPos;
      void main() {
        vec3 p = position;
        float w = sin(p.x * 0.45 + time * 0.9) * 0.04 + cos(p.z * 0.6 + time * 1.2) * 0.03;
        p.y += w;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 shallowColor;
      uniform vec3 deepColor;
      uniform float waterLevel;
      uniform sampler2D heightTex;
      uniform vec2 worldOrigin;
      uniform float worldSize;
      varying vec3 vWorldPos;

      void main() {
        // Sample terrain height at this fragment's world XZ.
        vec2 uv = (vWorldPos.xz - worldOrigin) / worldSize;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
        float groundY = texture2D(heightTex, uv).r;

        // If the ground is above water level here, no water — it's dry land.
        if (groundY >= waterLevel - 0.01) discard;

        // Depth = how far below waterLevel the ground sits at this XZ.
        float depth = clamp((waterLevel - groundY) * 0.32, 0.0, 1.0);
        vec3 col = mix(shallowColor, deepColor, depth);
        float a = mix(0.62, 0.85, depth);
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.y = -100;
  mesh.renderOrder = 2;
  return mesh;
}

export function createDammingSystem(opts: DammingOpts): DammingHandles {
  const marker = buildDamMarker(opts.damSite);
  opts.scene.add(marker);

  const heightTex = opts.terrain.toHeightTexture();
  const waterPlane = buildWaterPlane(opts.worldSize, heightTex, opts.terrain.worldOrigin);
  opts.scene.add(waterPlane);

  const handles: DammingHandles = {
    damSite: opts.damSite,
    marker,
    damLogs: [],
    waterLevel: opts.damSite.y - 0.02,
    waterPlane,
    update(dt, player, hauling, allLogs) {
      // If the player just dropped a log within the dam-site radius, claim it.
      // We detect this by scanning for ground-status logs near the dam that
      // we haven't already claimed.
      for (const log of allLogs) {
        if (log.status !== "ground") continue;
        if (handles.damLogs.includes(log)) continue;
        const xz = new THREE.Vector2(log.mesh.position.x - opts.damSite.x, log.mesh.position.z - opts.damSite.z);
        if (xz.length() <= DAM_SITE_RADIUS) {
          // Claim — snap to the dam, mark placed.
          log.status = "placed";
          // Stack visually: each successive log offsets along the dam axis +
          // a slight Y rise so the dam grows visibly.
          const i = handles.damLogs.length;
          const along = (i % 4) * 0.18 - 0.27;
          const ySnap = handles.waterLevel + 0.10 + Math.floor(i / 4) * 0.14;
          log.mesh.position.set(opts.damSite.x, ySnap, opts.damSite.z + along);
          log.mesh.rotation.set(0, Math.PI / 2, Math.PI / 2);
          handles.damLogs.push(log);
        }
      }

      // Target water level rises with dam log count, capped before flooding the
      // entire patch.
      const targetLevel = opts.damSite.y - 0.02 + handles.damLogs.length * WATER_RISE_PER_LOG;
      const cappedTarget = Math.min(targetLevel, opts.damSite.y + 2.4);
      // Smooth lerp toward target
      handles.waterLevel = THREE.MathUtils.lerp(handles.waterLevel, cappedTarget, Math.min(1, dt * WATER_RISE_LERP));

      // Update water plane Y + shader uniform
      waterPlane.position.y = handles.waterLevel;
      const mat = waterPlane.material as THREE.ShaderMaterial;
      mat.uniforms.time!.value = performance.now() * 0.001;
      mat.uniforms.waterLevel!.value = handles.waterLevel;
    },
  };

  return handles;
}
