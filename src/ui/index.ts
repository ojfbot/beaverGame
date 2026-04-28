import "./styles.css";
import { createMinimap, type MinimapHandles } from "./minimap";
import { createControlsOverlay, type ControlsOverlayHandles } from "./controls-overlay";
import type { WorldHandles } from "../scene/world";
import type { PlayerHandles } from "../scene/player";
import type { FellingHandles } from "../scene/felling";
import type { DammingHandles } from "../scene/damming";

export interface UIHandles {
  minimap: MinimapHandles;
  controls: ControlsOverlayHandles;
  // Called once per frame from the main tick.
  update(): void;
  destroy(): void;
}

export interface CreateUIOpts {
  player: PlayerHandles;
  world: WorldHandles;
  felling: FellingHandles;
  damming: DammingHandles;
  parent?: HTMLElement; // defaults to document.body
}

export function createUI(opts: CreateUIOpts): UIHandles {
  const parent = opts.parent ?? document.body;
  const minimap = createMinimap({
    parent,
    world: opts.world,
    player: opts.player,
    felling: opts.felling,
    damming: opts.damming,
  });
  const controls = createControlsOverlay({
    parent,
    playerState: opts.player.state,
  });

  return {
    minimap,
    controls,
    update() {
      minimap.update();
    },
    destroy() {
      minimap.destroy();
      controls.destroy();
    },
  };
}
