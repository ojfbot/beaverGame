import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Space } from "@babylonjs/core/Maths/math.axis";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";
import type { Terrain } from "./terrain";
import type { ColliderRegistry } from "./collision";
import type { DashHandles } from "./dash";
import { DASH_SPEED_MULT } from "./dash";
import { applySoftBound } from "./bounds";
import { enforceVertexColorMaterials } from "./materials";

// Beaver collision radius — wider than 0.30 because the model silhouette
// (head + flanks) extends past that and was visibly clipping into trunks.
const PLAYER_RADIUS = 0.45;
const WALK_SPEED = 2.4;
const SPRINT_MULT = 1.8;
const TURN_SPEED = 2.6;

export interface PlayerInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  interactQueued: boolean;
  interactHeld: boolean;
}

export interface PlayerHandles {
  root: TransformNode;
  position: Vector3;
  forward: () => Vector3;
  yaw: () => number;
  state: PlayerInputState;
  speedMultiplier: number;
  update(dt: number): void;
  destroy(): void;
}

export interface PlayerOpts {
  terrain: Terrain;
  camera: ArcRotateCamera;
  colliders?: ColliderRegistry;
  spawnXZ?: { x: number; z: number };
  // Optional double-tap dash. When dash.isDashing() returns true, the dash
  // direction (camera-relative) overrides WASD this frame and DASH_SPEED_MULT
  // is applied on top of walk speed.
  dash?: DashHandles;
}

function createInputBinding(state: PlayerInputState): { destroy(): void } {
  const set = (e: KeyboardEvent, down: boolean) => {
    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        state.forward = down; break;
      case "KeyS":
      case "ArrowDown":
        state.backward = down; break;
      case "KeyA":
      case "ArrowLeft":
        state.left = down; break;
      case "KeyD":
      case "ArrowRight":
        state.right = down; break;
      case "ShiftLeft":
      case "ShiftRight":
        state.sprint = down; break;
      case "KeyE":
        if (down) state.interactQueued = true;
        state.interactHeld = down;
        break;
    }
  };
  const onDown = (e: KeyboardEvent) => set(e, true);
  const onUp = (e: KeyboardEvent) => set(e, false);
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  return {
    destroy() {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    },
  };
}

export async function spawnPlayer(scene: Scene, opts: PlayerOpts): Promise<PlayerHandles> {
  const result = await SceneLoader.ImportMeshAsync("", "/assets/", "beaver_basic_v1.glb", scene);
  enforceVertexColorMaterials(result.meshes);
  const root = result.meshes[0] as TransformNode;
  if (!root) throw new Error("beaver_basic glTF returned no root mesh");

  const spawnX = opts.spawnXZ?.x ?? 0;
  const spawnZ = opts.spawnXZ?.z ?? 4;
  root.position.set(spawnX, opts.terrain.heightAt(spawnX, spawnZ), spawnZ);

  // Camera follows the beaver via lockedTarget. ArcRotateCamera handles
  // touchpad/mouse orbit + wheel zoom internally; the player code never
  // touches the camera again.
  opts.camera.lockedTarget = root;

  const state: PlayerInputState = {
    forward: false, backward: false, left: false, right: false, sprint: false,
    interactQueued: false, interactHeld: false,
  };
  const input = createInputBinding(state);

  // Babylon's glTF loader sets root.rotationQuaternion (encoding the
  // +Y → -Z Blender → glTF spec flip). When the quaternion is non-null,
  // Babylon ignores root.rotation Euler values for rendering. So we rotate
  // via root.rotate() (representation-agnostic API) and track yaw in a
  // closure variable for camera coupling + the forward() vector.
  let yaw = 0;

  // Beaver yaw=0 (closure value) corresponds to the spawn facing (-Z per
  // glTF base orientation). forward() reads the closure yaw, not root.rotation.
  const forward = (): Vector3 =>
    new Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));

  function update(dt: number): void {
    // Camera-relative WASD (Zelda/Mario-style). W = away from camera, S = toward,
    // A/D = camera-relative left/right strafe. Body yaw smoothly chases the
    // velocity vector so the beaver always faces where it walks.
    // Dash overrides WASD this frame: direction comes from the captured tap,
    // speed is multiplied. Held WASD inputs are ignored during the dash window.
    const dashing = opts.dash?.isDashing() ?? false;
    const f = dashing ? opts.dash!.state.dirF : ((state.forward ? 1 : 0) - (state.backward ? 1 : 0));
    const r = dashing ? opts.dash!.state.dirR : ((state.right ? 1 : 0) - (state.left ? 1 : 0));
    const moving = f !== 0 || r !== 0;

    if (moving) {
      const camForward = root.position.subtract(opts.camera.position);
      camForward.y = 0;
      // Guard: if camera is stacked exactly on the beaver (zero-length), bail
      // — otherwise the cross + normalize below NaN the position vector.
      if (camForward.lengthSquared() < 1e-6) return;
      camForward.normalize();
      // Babylon is left-handed: with the camera at +Z looking toward -Z, world
      // +X projects to screen-LEFT, so screen-right = Cross(up, forward).
      const camRight = Vector3.Cross(Vector3.Up(), camForward).normalize();
      const move = camForward.scale(f).addInPlace(camRight.scale(r));
      if (move.lengthSquared() > 0) move.normalize();
      const speed = WALK_SPEED * (state.sprint ? SPRINT_MULT : 1) * handles.speedMultiplier
        * (dashing ? DASH_SPEED_MULT : 1);
      root.position.addInPlace(move.scale(speed * dt));

      // forward() = (-sin yaw, 0, -cos yaw) ⇒ targetYaw for moving in `move` is atan2(-x, -z).
      const targetYaw = Math.atan2(-move.x, -move.z);
      let dYaw = targetYaw - yaw;
      while (dYaw > Math.PI) dYaw -= 2 * Math.PI;
      while (dYaw < -Math.PI) dYaw += 2 * Math.PI;
      const maxStep = TURN_SPEED * dt;
      const step = Math.max(-maxStep, Math.min(maxStep, dYaw));
      yaw += step;
      root.rotate(Vector3.Up(), step, Space.LOCAL);
    }

    if (opts.colliders) {
      const c = opts.colliders.resolve(root.position.x, root.position.z, PLAYER_RADIUS);
      root.position.x = c.x;
      root.position.z = c.z;
    }

    const bounded = applySoftBound(root.position, {
      halfExtent: opts.terrain.halfExtent,
      hardMargin: 0.6,
      softMargin: 1.5,
    });
    root.position.copyFrom(bounded);

    // Sample terrain at the beaver's footprint corners, not just its center.
    // On steep slopes, a center-only sample lets the body clip into the hill
    // wall right next to the beaver. Using max() lifts the beaver to ride on
    // top of the highest terrain in its footprint.
    const fr = PLAYER_RADIUS;
    const ground = Math.max(
      opts.terrain.heightAt(root.position.x, root.position.z),
      opts.terrain.heightAt(root.position.x + fr, root.position.z),
      opts.terrain.heightAt(root.position.x - fr, root.position.z),
      opts.terrain.heightAt(root.position.x, root.position.z + fr),
      opts.terrain.heightAt(root.position.x, root.position.z - fr),
    );
    const bob = moving ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.04 : 0;
    root.position.y = ground + bob;

    // Camera-above-terrain enforcement. ArcRotateCamera's position is recomputed
    // each frame from (alpha, beta, radius, target). Predict where it will land
    // and tighten beta if that point would be inside / below the terrain.
    const cam = opts.camera;
    const target = cam.target;
    const sinB = Math.sin(cam.beta);
    const cosA = Math.cos(cam.alpha);
    const sinA = Math.sin(cam.alpha);
    const camPredX = target.x + cam.radius * sinB * cosA;
    const camPredZ = target.z + cam.radius * sinB * sinA;
    const CAM_CLEARANCE = 0.6;
    const minCamY = opts.terrain.heightAt(camPredX, camPredZ) + CAM_CLEARANCE;
    const cosBNeeded = (minCamY - target.y) / cam.radius;
    if (cosBNeeded > -1 && cosBNeeded < 1) {
      const maxBeta = Math.acos(cosBNeeded);
      // Take the tighter of the user's static cap and the dynamic terrain cap.
      const upper = cam.upperBetaLimit ?? maxBeta;
      const dynUpper = Math.min(upper, maxBeta);
      if (cam.beta > dynUpper) cam.beta = dynUpper;
    }
  }

  const handles: PlayerHandles = {
    root,
    position: root.position,
    forward,
    yaw: () => yaw,
    state,
    speedMultiplier: 1.0,
    update,
    destroy() {
      input.destroy();
      result.meshes.forEach((m) => m.dispose());
    },
  };
  return handles;
}
