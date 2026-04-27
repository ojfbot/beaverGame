import * as THREE from "three";
import { loadValidatedGlb } from "./load-glb";
import { enforceVertexColorMaterials } from "./materials";

const WALK_SPEED = 2.4; // units / second
const SPRINT_MULT = 1.8;
const TURN_SPEED = 2.6; // radians / second

export interface PlayerHandles {
  group: THREE.Group;
  update(dt: number, camera: THREE.PerspectiveCamera): void;
  destroy(): void;
}

interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

function createInputBinding(): { state: InputState; destroy(): void } {
  const state: InputState = { forward: false, backward: false, left: false, right: false, sprint: false };
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
    }
  };
  const onDown = (e: KeyboardEvent) => set(e, true);
  const onUp = (e: KeyboardEvent) => set(e, false);
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  return {
    state,
    destroy() {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    },
  };
}

export async function spawnPlayer(scene: THREE.Scene): Promise<PlayerHandles> {
  const beaver = await loadValidatedGlb("/assets/beaver_basic_v1.glb");
  enforceVertexColorMaterials(beaver);
  beaver.position.set(0, 0, 0);
  scene.add(beaver);

  const input = createInputBinding();
  const cameraTarget = new THREE.Vector3();
  const cameraDesired = new THREE.Vector3();
  // Beaver model in Blender faces +Y, which becomes -Z in glTF/Three. So
  // "behind" the beaver is the +Z direction relative to its facing.
  const cameraOffset = new THREE.Vector3(0, 2.4, 4.5);

  function update(dt: number, camera: THREE.PerspectiveCamera): void {
    const s = input.state;
    // Yaw: A/D rotate the beaver in place
    const turn = (s.left ? 1 : 0) - (s.right ? 1 : 0);
    beaver.rotation.y += turn * TURN_SPEED * dt;

    // Forward/back along the beaver's facing direction (beaver model points +Y)
    const move = (s.forward ? 1 : 0) - (s.backward ? 1 : 0);
    if (move !== 0) {
      const speed = WALK_SPEED * (s.sprint ? SPRINT_MULT : 1);
      // Beaver model faces -Z at yaw=0; flip signs so W moves toward the nose.
      const forward = new THREE.Vector3(
        -Math.sin(beaver.rotation.y),
        0,
        -Math.cos(beaver.rotation.y)
      );
      beaver.position.addScaledVector(forward, move * speed * dt);

      // Lazy bobbing: bob amplitude tied to motion
      const bob = Math.sin(performance.now() * 0.012) * 0.04;
      beaver.position.y = Math.max(0, bob);
    } else {
      beaver.position.y = 0;
    }

    // 3rd-person follow camera with soft lag.
    const local = cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), beaver.rotation.y);
    cameraDesired.copy(beaver.position).add(local);
    camera.position.lerp(cameraDesired, Math.min(1, dt * 4.5));
    cameraTarget.lerp(beaver.position.clone().setY(beaver.position.y + 0.7), Math.min(1, dt * 6));
    camera.lookAt(cameraTarget);
  }

  return {
    group: beaver,
    update,
    destroy() {
      input.destroy();
      scene.remove(beaver);
    },
  };
}
