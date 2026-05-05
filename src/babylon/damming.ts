import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Effect } from "@babylonjs/core/Materials/effect";
import type { LogEntity } from "./log";
import type { PlayerHandles } from "./player";
import type { Terrain } from "./terrain";

// Stylized water + dam. Drop a "ground" log within DAM_SITE_RADIUS of the
// dam site → it snaps onto the dam stack and the water level rises. The
// water shader samples terrain height to discard fragments where the ground
// rises above water (so the flood is contained by topography + dugouts).

const DAM_SITE_RADIUS = 1.4;
const WATER_RISE_PER_LOG = 0.35;
const WATER_RISE_LERP = 1.6;

const WATER_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
uniform mat4 world;
uniform float time;
varying vec3 vWorldPos;
void main() {
  vec3 p = position;
  float w = sin(p.x * 0.45 + time * 0.9) * 0.04 + cos(p.z * 0.6 + time * 1.2) * 0.03;
  p.y += w;
  vec4 wp = world * vec4(p, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = worldViewProjection * vec4(p, 1.0);
}
`;

const WATER_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vWorldPos;
uniform vec3 shallowColor;
uniform vec3 deepColor;
uniform float waterLevel;
uniform sampler2D heightTex;
uniform vec2 worldOrigin;
uniform float worldSize;

void main() {
  vec2 uv = (vWorldPos.xz - worldOrigin) / worldSize;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
  float groundY = texture2D(heightTex, uv).r;
  // Render water only where the ground sits below the water level here.
  if (groundY >= waterLevel - 0.01) discard;
  float depth = clamp((waterLevel - groundY) * 0.32, 0.0, 1.0);
  vec3 col = mix(shallowColor, deepColor, depth);
  float a = mix(0.62, 0.85, depth);
  gl_FragColor = vec4(col, a);
}
`;

let shadersRegistered = false;
function registerWaterShaders(): void {
  if (shadersRegistered) return;
  Effect.ShadersStore["beaverWaterVertexShader"] = WATER_VERTEX;
  Effect.ShadersStore["beaverWaterFragmentShader"] = WATER_FRAGMENT;
  shadersRegistered = true;
}

function buildDamMarker(scene: Scene, damSite: Vector3): TransformNode {
  const group = new TransformNode("dam-marker", scene);
  group.position.copyFrom(damSite);

  // Two stakes flanking the flow — visible affordance.
  const stakeMat = new StandardMaterial("dam-stake-mat", scene);
  stakeMat.diffuseColor = new Color3(163 / 255, 126 / 255, 88 / 255);
  stakeMat.specularColor = new Color3(0, 0, 0);
  for (const x of [-0.6, 0.6]) {
    const stake = MeshBuilder.CreateCylinder(`dam-stake-${x}`, {
      height: 0.7,
      diameterTop: 0,
      diameterBottom: 0.12,
      tessellation: 5,
    }, scene);
    stake.parent = group;
    stake.material = stakeMat;
    stake.position.set(x, 0.4, 0);
    stake.rotation.z = (x < 0 ? -1 : 1) * 0.15;
  }

  // Faint disc marking the contribution radius.
  const ring = MeshBuilder.CreateDisc("dam-ring", {
    radius: DAM_SITE_RADIUS,
    tessellation: 32,
    sideOrientation: Mesh.DOUBLESIDE,
  }, scene);
  ring.parent = group;
  ring.position.y = 0.02;
  ring.rotation.x = Math.PI / 2;
  const ringMat = new StandardMaterial("dam-ring-mat", scene);
  ringMat.diffuseColor = new Color3(216 / 255, 228 / 255, 210 / 255);
  ringMat.alpha = 0.32;
  ringMat.specularColor = new Color3(0, 0, 0);
  ringMat.disableLighting = true;
  ringMat.emissiveColor = new Color3(216 / 255, 228 / 255, 210 / 255);
  ring.material = ringMat;

  return group;
}

function buildWaterPlane(scene: Scene, terrain: Terrain): Mesh {
  registerWaterShaders();
  const plane = MeshBuilder.CreateGround("water", {
    width: terrain.worldSize,
    height: terrain.worldSize,
    subdivisions: 32,
    updatable: false,
  }, scene);
  // Render under most things; alpha-blended with the terrain.
  plane.alphaIndex = 2;
  plane.position.y = -100;

  const mat = new ShaderMaterial("beaverWater", scene, "beaverWater", {
    attributes: ["position"],
    uniforms: ["worldViewProjection", "world", "time", "shallowColor", "deepColor", "waterLevel", "worldOrigin", "worldSize"],
    samplers: ["heightTex"],
    needAlphaBlending: true,
  });
  mat.setTexture("heightTex", terrain.toHeightTexture(scene));
  mat.setColor3("shallowColor", new Color3(188 / 255, 224 / 255, 216 / 255));
  mat.setColor3("deepColor", new Color3(90 / 255, 138 / 255, 160 / 255));
  mat.setFloat("waterLevel", 0);
  mat.setVector2("worldOrigin", terrain.worldOrigin);
  mat.setFloat("worldSize", terrain.worldSize);
  mat.setFloat("time", 0);
  mat.backFaceCulling = false;
  plane.material = mat;
  // We want translucent water without it self-occluding via z-write.
  mat.needDepthPrePass = false;
  return plane;
}

export interface DammingHandles {
  damSite: Vector3;
  marker: TransformNode;
  damLogs: LogEntity[];
  waterLevel: number;
  waterPlane: Mesh;
  update(dt: number, player: PlayerHandles, allLogs: LogEntity[]): void;
  destroy(): void;
}

export interface DammingOpts {
  scene: Scene;
  terrain: Terrain;
  damSite: Vector3;
}

export function createDammingSystem(opts: DammingOpts): DammingHandles {
  const marker = buildDamMarker(opts.scene, opts.damSite);
  const waterPlane = buildWaterPlane(opts.scene, opts.terrain);

  const handles: DammingHandles = {
    damSite: opts.damSite,
    marker,
    damLogs: [],
    waterLevel: opts.damSite.y - 0.02,
    waterPlane,
    update(dt, _player, allLogs) {
      // Claim any "ground" log dropped within the dam-site radius.
      for (const log of allLogs) {
        if (log.status !== "ground") continue;
        if (handles.damLogs.includes(log)) continue;
        const dx = log.mesh.position.x - opts.damSite.x;
        const dz = log.mesh.position.z - opts.damSite.z;
        if (Math.hypot(dx, dz) <= DAM_SITE_RADIUS) {
          log.status = "placed";
          // Stack visually: each log offsets along the dam axis with a slight
          // Y rise so the dam grows visibly as logs accrue.
          const i = handles.damLogs.length;
          const along = (i % 4) * 0.18 - 0.27;
          const ySnap = handles.waterLevel + 0.10 + Math.floor(i / 4) * 0.14;
          log.mesh.position.set(opts.damSite.x, ySnap, opts.damSite.z + along);
          log.mesh.rotation.set(0, Math.PI / 2, Math.PI / 2);
          handles.damLogs.push(log);
        }
      }

      const target = Math.min(
        opts.damSite.y + 2.4,
        opts.damSite.y - 0.02 + handles.damLogs.length * WATER_RISE_PER_LOG,
      );
      const k = Math.min(1, dt * WATER_RISE_LERP);
      handles.waterLevel = handles.waterLevel + (target - handles.waterLevel) * k;

      waterPlane.position.y = handles.waterLevel;
      const mat = waterPlane.material as ShaderMaterial;
      mat.setFloat("time", performance.now() * 0.001);
      mat.setFloat("waterLevel", handles.waterLevel);
    },
    destroy(): void {
      waterPlane.dispose();
      marker.dispose();
    },
  };

  return handles;
}
