import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";
import type { Terrain } from "./terrain";
import type { ColliderRegistry } from "./collision";
import { applySoftBound } from "./bounds";
import { enforceVertexColorMaterials } from "./materials";

const PLAYER_RADIUS = 0.30;
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
  state: PlayerInputState;
  speedMultiplier: number;
  update(dt: number): void;
  destroy(): void;
}

export interface PlayerOpts {
  terrain: Terrain;
  camera: UniversalCamera;
  colliders?: ColliderRegistry;
  spawnXZ?: { x: number; z: number };
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
  // glTF loader returns a __root__ wrapper at meshes[0]; reuse it as the
  // player's transform root.
  const root = result.meshes[0] as TransformNode;
  if (!root) throw new Error("beaver_basic glTF returned no root mesh");

  const spawnX = opts.spawnXZ?.x ?? 0;
  const spawnZ = opts.spawnXZ?.z ?? 4;
  root.position.set(spawnX, opts.terrain.heightAt(spawnX, spawnZ), spawnZ);
  // glTF loader already accounts for Blender +Y → glTF -Z; matches Three.js
  // semantics so yaw=0 faces -Z.

  const state: PlayerInputState = {
    forward: false, backward: false, left: false, right: false, sprint: false,
    interactQueued: false, interactHeld: false,
  };
  const input = createInputBinding(state);

  const cameraOffsetLocal = new Vector3(0, 2.4, 4.5);
  const cameraDesired = new Vector3();
  const cameraTarget = new Vector3();

  const forward = (): Vector3 =>
    new Vector3(-Math.sin(root.rotation.y), 0, -Math.cos(root.rotation.y));

  function update(dt: number): void {
    const turn = (state.left ? 1 : 0) - (state.right ? 1 : 0);
    root.rotation.y += turn * TURN_SPEED * dt;

    const move = (state.forward ? 1 : 0) - (state.backward ? 1 : 0);
    if (move !== 0) {
      const speed = WALK_SPEED * (state.sprint ? SPRINT_MULT : 1) * handles.speedMultiplier;
      const f = forward();
      root.position.addInPlace(f.scale(move * speed * dt));
    }

    if (opts.colliders) {
      const r = opts.colliders.resolve(root.position.x, root.position.z, PLAYER_RADIUS);
      root.position.x = r.x;
      root.position.z = r.z;
    }

    const bounded = applySoftBound(root.position, {
      halfExtent: opts.terrain.halfExtent,
      hardMargin: 0.6,
      softMargin: 1.5,
    });
    root.position.copyFrom(bounded);

    const ground = opts.terrain.heightAt(root.position.x, root.position.z);
    const bob = move !== 0 ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.04 : 0;
    root.position.y = ground + bob;

    // Camera follow with soft lag — manual lerp mirrors the Three.js version.
    const yaw = root.rotation.y;
    const offX = cameraOffsetLocal.x * Math.cos(yaw) + cameraOffsetLocal.z * Math.sin(yaw);
    const offZ = -cameraOffsetLocal.x * Math.sin(yaw) + cameraOffsetLocal.z * Math.cos(yaw);
    cameraDesired.set(
      root.position.x + offX,
      root.position.y + cameraOffsetLocal.y,
      root.position.z + offZ,
    );
    const camGround = opts.terrain.heightAt(cameraDesired.x, cameraDesired.z) + 0.4;
    if (cameraDesired.y < camGround) cameraDesired.y = camGround;

    const camLerp = Math.min(1, dt * 4.5);
    opts.camera.position.copyFrom(
      Vector3.Lerp(opts.camera.position, cameraDesired, camLerp),
    );

    cameraTarget.set(
      root.position.x,
      root.position.y + 0.7,
      root.position.z,
    );
    const targetLerp = Math.min(1, dt * 6);
    opts.camera.setTarget(
      Vector3.Lerp(opts.camera.getTarget(), cameraTarget, targetLerp),
    );
  }

  const handles: PlayerHandles = {
    root,
    position: root.position,
    forward,
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
