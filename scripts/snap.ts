// Quick visual probe: open the dev server in headless chromium, wait for the
// world to render, screenshot, and (optionally) capture console errors.
// Iteration loop while building the spawn.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const URL = process.env.SNAP_URL ?? "http://localhost:5173/";
const OUT = process.env.SNAP_OUT ?? "tmp/snap.png";
const VIEWPORT = { width: 1280, height: 800 };
const SETTLE_MS = Number(process.env.SNAP_SETTLE_MS ?? 1500);

(async () => {
  mkdirSync("tmp", { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const consoleLines: string[] = [];
  page.on("console", (msg) => {
    consoleLines.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    consoleLines.push(`[pageerror] ${err.message}`);
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(SETTLE_MS);

  // Optional scenario: SNAP_SCENARIO=fell-tree
  const scenario = process.env.SNAP_SCENARIO;
  if (scenario === "dam-built") {
    // Full M-α → M-δ chain: build the dam, frame it from above.
    await page.evaluate(async () => {
      const w = window as unknown as { __beaver?: { testBuildDam?: (n: number) => Promise<unknown>; setDamCamera?: () => void } };
      await w.__beaver?.testBuildDam?.(5);
      w.__beaver?.setDamCamera?.();
    });
    await page.waitForTimeout(2500); // let the water lerp to its target
  } else if (scenario === "fell-and-haul") {
    // Full M-γ proof: fell, then pickup. Snap shows beaver carrying the log.
    await page.evaluate(() => {
      const w = window as unknown as { __beaver?: { testFellNearestTree?: () => unknown } };
      return w.__beaver?.testFellNearestTree?.();
    });
    await page.waitForTimeout(5500);
    await page.evaluate(() => {
      const w = window as unknown as { __beaver?: { testPickUpNearestLog?: () => unknown } };
      return w.__beaver?.testPickUpNearestLog?.();
    });
    await page.waitForTimeout(800);
  } else if (scenario === "fell-tree" || scenario === "fell-tree-overview") {
    const target = await page.evaluate(() => {
      const w = window as unknown as { __beaver?: { testFellNearestTree?: () => unknown } };
      return w.__beaver?.testFellNearestTree?.() as { tree: number[] } | null;
    });
    // Wait long enough for gnaw + fall (gnaw ~2.6s, fall 1s, plus settle).
    await page.waitForTimeout(5500);
    if (scenario === "fell-tree-overview" && target) {
      await page.evaluate((t: number[]) => {
        const w = window as unknown as { __beaver?: { setOverviewCamera?: (xz: { x: number; z: number }) => void } };
        w.__beaver?.setOverviewCamera?.({ x: t[0]!, z: t[2]! });
      }, target.tree);
      await page.waitForTimeout(500);
    }
  }

  const buf = await page.screenshot({ type: "png" });
  writeFileSync(OUT, buf);
  writeFileSync(join("tmp", "snap.console.txt"), consoleLines.join("\n"));

  // Pull scene state so we can see what's loaded and where.
  // The client exposes window.__beaver for this purpose (see main.ts).
  const probe = await page.evaluate(() => {
    const w = window as unknown as { __beaver?: any };
    if (!w.__beaver) return { loaded: false };
    const { scene, player } = w.__beaver;
    const summary: Record<string, unknown> = {
      loaded: true,
      childCount: scene?.scene?.children?.length ?? 0,
      cameraPos: scene?.camera?.position?.toArray?.() ?? null,
      cameraTarget: scene?.cameraTarget ?? null,
      beaverPos: player?.group?.position?.toArray?.() ?? null,
      beaverRotY: player?.group?.rotation?.y ?? null,
      childrenSummary: (scene?.scene?.children ?? []).map((c: any) => ({
        name: c.name || "(unnamed)",
        type: c.type,
        pos: c.position.toArray(),
        visible: c.visible,
      })),
      treeStateCounts: (() => {
        const counts: Record<string, number> = {};
        for (const t of (w.__beaver?.world?.treeStates ?? [])) {
          counts[t.status] = (counts[t.status] ?? 0) + 1;
        }
        return counts;
      })(),
      logCount: w.__beaver?.felling?.logs?.length ?? 0,
      logStatuses: (w.__beaver?.felling?.logs ?? []).map((l: any) => l.status),
      carriedLog: w.__beaver?.hauling?.carriedLog ? "yes" : "no",
      speedMultiplier: w.__beaver?.hauling?.speedMultiplier ?? null,
      damLogCount: w.__beaver?.damming?.damLogs?.length ?? 0,
      waterLevel: w.__beaver?.damming?.waterLevel ?? null,
      damSite: w.__beaver?.damming?.damSite?.toArray?.() ?? null,
      vertexColorSamples: (() => {
        const out: any[] = [];
        scene?.scene?.traverse?.((node: any) => {
          if (out.length >= 3) return;
          if (node.isMesh && node.geometry?.attributes?.color) {
            const a = node.geometry.attributes.color;
            const sample: number[] = [];
            for (let i = 0; i < Math.min(a.count, 3); i++) {
              sample.push(
                +a.getX(i).toFixed(3),
                +a.getY(i).toFixed(3),
                +a.getZ(i).toFixed(3)
              );
            }
            out.push({
              meshName: node.name || node.parent?.name || "?",
              count: a.count,
              normalized: a.normalized,
              itemSize: a.itemSize,
              materialColor: node.material?.color?.toArray?.(),
              vertexColors: node.material?.vertexColors,
              firstFew: sample,
            });
          }
        });
        return out;
      })(),
    };
    return summary;
  });

  console.log(`saved ${OUT}`);
  console.log("scene probe:", JSON.stringify(probe, null, 2));
  console.log(`console lines: ${consoleLines.length}`);
  if (consoleLines.length) {
    console.log("─── console ───");
    console.log(consoleLines.slice(0, 30).join("\n"));
  }

  await browser.close();
})().catch((err) => {
  console.error("snap failed:", err);
  process.exit(1);
});
