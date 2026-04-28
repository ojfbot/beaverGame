import * as THREE from "three";
import { loadValidatedGlb } from "./load-glb";
import { enforceVertexColorMaterials } from "./materials";
import type { Terrain } from "./terrain";

const WALK_SPEED = 2.4;
const SPRINT_MULT = 1.8;
const TURN_SPEED = 2.6;

export interface PlayerHandles {
  group: THREE.Group;
  position: THREE.Vector3;
  // Yaw normal (forward direction), useful for interaction targeting.
  forward: () => THREE.Vector3;
  state: PlayerInputState;
  // Multiplier applied to walk/sprint speed each frame. Other systems
  // (hauling, water-as-highway) write here before update() runs.
  speedMultiplier: number;
  update(dt: number, camera: THREE.PerspectiveCamera): void;
  destroy(): void;
}

export interface PlayerInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  // Edge-triggered "interact" — the player handler exposes a queue that other
  // systems (felling, hauling, damming) drain on each frame. Keeps inputs
  // out of cross-cutting state.
  interactQueued: boolean;
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
        // Edge-trigger: only flag on keydown, not held.
        if (down) state.interactQueued = true;
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

export interface PlayerOpts {
  terrain: Terrain;
  spawnXZ?: { x: number; z: number };
}

export async function spawnPlayer(scene: THREE.Scene, opts: PlayerOpts): Promise<PlayerHandles> {
  const beaver = await loadValidatedGlb("/assets/beaver_basic_v1.glb");
  enforceVertexColorMaterials(beaver);

  const spawnX = opts.spawnXZ?.x ?? 0;
  const spawnZ = opts.spawnXZ?.z ?? 4;
  beaver.position.set(spawnX, opts.terrain.heightAt(spawnX, spawnZ), spawnZ);
  scene.add(beaver);

  const state: PlayerInputState = {
    forward: false, backward: false, left: false, right: false, sprint: false,
    interactQueued: false,
  };
  const input = createInputBinding(state);

  const cameraOffsetLocal = new THREE.Vector3(0, 2.4, 4.5);
  const cameraDesired = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();

  // Beaver yaw=0 faces -Z (Blender +Y → glTF -Z).
  const forward = (): THREE.Vector3 =>
    new THREE.Vector3(-Math.sin(beaver.rotation.y), 0, -Math.cos(beaver.rotation.y));

  function update(dt: number, camera: THREE.PerspectiveCamera): void {
    // Yaw
    const turn = (state.left ? 1 : 0) - (state.right ? 1 : 0);
    beaver.rotation.y += turn * TURN_SPEED * dt;

    // Forward / back along facing
    const move = (state.forward ? 1 : 0) - (state.backward ? 1 : 0);
    if (move !== 0) {
      const speed = WALK_SPEED * (state.sprint ? SPRINT_MULT : 1) * handles.speedMultiplier;
      const f = forward();
      beaver.position.addScaledVector(f, move * speed * dt);
    }

    // Clamp to terrain patch (with margin so we don't stand on the edge fall-off)
    const margin = opts.terrain.halfExtent - 0.6;
    beaver.position.x = THREE.MathUtils.clamp(beaver.position.x, -margin, margin);
    beaver.position.z = THREE.MathUtils.clamp(beaver.position.z, -margin, margin);

    // Sit on terrain. Tiny vertical bob while walking adds tactile feedback.
    const ground = opts.terrain.heightAt(beaver.position.x, beaver.position.z);
    const bob = move !== 0 ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.04 : 0;
    beaver.position.y = ground + bob;

    // Camera follow with soft lag
    const localOffset = cameraOffsetLocal.clone().applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      beaver.rotation.y
    );
    cameraDesired.copy(beaver.position).add(localOffset);
    // Don't let the camera dip below the ground at its XZ
    const camGround = opts.terrain.heightAt(cameraDesired.x, cameraDesired.z) + 0.4;
    if (cameraDesired.y < camGround) cameraDesired.y = camGround;
    camera.position.lerp(cameraDesired, Math.min(1, dt * 4.5));
    cameraTarget.lerp(beaver.position.clone().setY(beaver.position.y + 0.7), Math.min(1, dt * 6));
    camera.lookAt(cameraTarget);
  }

  const handles: PlayerHandles = {
    group: beaver,
    position: beaver.position,
    forward,
    state,
    speedMultiplier: 1.0,
    update,
    destroy() {
      input.destroy();
      scene.remove(beaver);
    },
  };
  return handles;
}
