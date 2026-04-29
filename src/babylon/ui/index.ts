import "./styles.css";
import { createMinimap, type MinimapHandles } from "./minimap";
import { createControlsOverlay, type ControlsOverlayHandles } from "./controls-overlay";
import type { Terrain } from "../terrain";
import type { PlayerHandles } from "../player";

export interface UIHandles {
  minimap: MinimapHandles;
  controls: ControlsOverlayHandles;
  update(): void;
  destroy(): void;
}

export interface CreateUIOpts {
  terrain: Terrain;
  player: PlayerHandles;
  treePositions: { x: number; z: number }[];
  parent?: HTMLElement;
}

export function createUI(opts: CreateUIOpts): UIHandles {
  const parent = opts.parent ?? document.body;
  const minimap = createMinimap({
    parent,
    terrain: opts.terrain,
    player: opts.player,
    treePositions: opts.treePositions,
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
