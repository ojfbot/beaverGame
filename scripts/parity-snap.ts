// Parity snap — drive Three.js and Babylon entries with the same input
// sequence; measure beaver position/yaw deltas; capture screenshots side by
// side. Used during the Three.js → Babylon migration to quantify visual
// and behavioral regressions.
//
// Usage:
//   pnpm dev                     # in one terminal
//   pnpm tsx scripts/parity-snap.ts   # in another
//   open tmp/parity/index.html   # view side-by-side report
//
// Both entries run on the same dev server; toggle via URL:
//   http://localhost:5173/        → Babylon (index.html)
//   http://localhost:5173/three.html → Three.js (legacy)

import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.SNAP_URL ?? "http://localhost:5173";
const OUT = process.env.SNAP_OUT ?? "tmp/parity";
const VIEWPORT = { width: 1280, height: 800 };
const SETTLE_MS = 1800;

type Snapshot = {
  label: string;
  beaver: { x: number; y: number; z: number; yawDeg: number } | null;
  imagePath: string;
  console: string[];
};

type Run = {
  engine: "three" | "babylon";
  url: string;
  snapshots: Snapshot[];
};

async function readBeaver(page: Page, engine: "three" | "babylon"): Promise<Snapshot["beaver"]> {
  return page.evaluate((e) => {
    const w = window as unknown as {
      __beaver?: { player?: { position: { x: number; y: number; z: number }; group?: { rotation: { y: number } } } };
      __beaverBabylon?: { player?: { position: { x: number; y: number; z: number }; root?: { rotation: { y: number } } } };
    };
    if (e === "three") {
      const p = w.__beaver?.player;
      if (!p?.position) return null;
      const yaw = p.group?.rotation.y ?? 0;
      return { x: p.position.x, y: p.position.y, z: p.position.z, yawDeg: (yaw * 180) / Math.PI };
    }
    const p = w.__beaverBabylon?.player;
    if (!p?.position) return null;
    const yaw = p.root?.rotation.y ?? 0;
    return { x: p.position.x, y: p.position.y, z: p.position.z, yawDeg: (yaw * 180) / Math.PI };
  }, engine);
}

async function press(page: Page, key: string, durationMs: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(durationMs);
  await page.keyboard.up(key);
  await page.waitForTimeout(120); // settle
}

async function snapEngine(engine: "three" | "babylon"): Promise<Run> {
  const url = engine === "three" ? `${BASE}/three.html` : `${BASE}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const consoleLines: string[] = [];
  page.on("console", (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => consoleLines.push(`[pageerror] ${err.message}`));

  console.log(`\n=== ${engine.toUpperCase()} (${url}) ===`);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(SETTLE_MS);

  // Click the canvas to focus key events (some setups need this).
  await page.click("#game");

  const snapshots: Snapshot[] = [];

  async function takeSnap(label: string): Promise<void> {
    const imagePath = join(OUT, `${engine}-${label}.png`);
    await page.screenshot({ path: imagePath, fullPage: false });
    const beaver = await readBeaver(page, engine);
    snapshots.push({
      label,
      beaver,
      imagePath: `${engine}-${label}.png`,
      console: [...consoleLines],
    });
    console.log(`  [${label}] beaver = ${beaver ? `(${beaver.x.toFixed(2)}, ${beaver.y.toFixed(2)}, ${beaver.z.toFixed(2)}) yaw=${beaver.yawDeg.toFixed(1)}°` : "null"}`);
  }

  await takeSnap("00-spawn");

  // Drive 1s of W (forward).
  await press(page, "KeyW", 1000);
  await takeSnap("01-after-1s-W");

  // Drive 1s of A (turn left).
  await press(page, "KeyA", 1000);
  await takeSnap("02-after-1s-A");

  // Drive 1s of W with Shift (sprint).
  await page.keyboard.down("ShiftLeft");
  await press(page, "KeyW", 1000);
  await page.keyboard.up("ShiftLeft");
  await takeSnap("03-after-1s-sprint-W");

  await browser.close();
  return { engine, url, snapshots };
}

function diff(a: number | undefined, b: number | undefined): string {
  if (a == null || b == null) return "N/A";
  const d = b - a;
  return `${d >= 0 ? "+" : ""}${d.toFixed(2)}`;
}

function buildReport(three: Run, babylon: Run): string {
  let md = `# Parity snap — Three.js vs Babylon\n\n`;
  md += `Driven inputs: ` + babylon.snapshots.map((s) => s.label).join(" → ") + `\n\n`;

  md += `## Beaver state at each step\n\n`;
  md += `| Step | Three.js (x, y, z, yaw°) | Babylon (x, y, z, yaw°) | Δx | Δy | Δz | Δyaw° |\n`;
  md += `|---|---|---|---|---|---|---|\n`;
  for (let i = 0; i < three.snapshots.length; i++) {
    const t = three.snapshots[i]!.beaver;
    const b = babylon.snapshots[i]!.beaver;
    const tFmt = t ? `(${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)}, ${t.yawDeg.toFixed(1)})` : "null";
    const bFmt = b ? `(${b.x.toFixed(2)}, ${b.y.toFixed(2)}, ${b.z.toFixed(2)}, ${b.yawDeg.toFixed(1)})` : "null";
    md += `| ${three.snapshots[i]!.label} | ${tFmt} | ${bFmt} | ${diff(t?.x, b?.x)} | ${diff(t?.y, b?.y)} | ${diff(t?.z, b?.z)} | ${diff(t?.yawDeg, b?.yawDeg)} |\n`;
  }

  md += `\n## Screenshots\n\n`;
  md += `| Step | Three.js | Babylon |\n|---|---|---|\n`;
  for (let i = 0; i < three.snapshots.length; i++) {
    md += `| ${three.snapshots[i]!.label} | ![three](${three.snapshots[i]!.imagePath}) | ![babylon](${babylon.snapshots[i]!.imagePath}) |\n`;
  }

  // Console errors (last 20 lines per engine).
  md += `\n## Console (Three.js, last 20)\n\n\`\`\`\n${three.snapshots.at(-1)!.console.slice(-20).join("\n")}\n\`\`\`\n`;
  md += `\n## Console (Babylon, last 20)\n\n\`\`\`\n${babylon.snapshots.at(-1)!.console.slice(-20).join("\n")}\n\`\`\`\n`;

  return md;
}

function buildHtmlReport(three: Run, babylon: Run): string {
  const cell = (snap: Snapshot) => `
    <td>
      <img src="${snap.imagePath}" style="max-width:100%;border:1px solid #ccc"/>
      <div style="font-family:monospace;font-size:11px;padding:4px">
        ${snap.beaver
          ? `pos=(${snap.beaver.x.toFixed(2)}, ${snap.beaver.y.toFixed(2)}, ${snap.beaver.z.toFixed(2)}) yaw=${snap.beaver.yawDeg.toFixed(1)}°`
          : "no beaver state"}
      </div>
    </td>`;
  let html = `<!doctype html><html><head><title>Parity</title></head><body style="font-family:system-ui">
  <h1>Parity snap</h1>
  <table border="0" cellspacing="8" cellpadding="0">
    <tr><th>Step</th><th>Three.js (legacy)</th><th>Babylon (in progress)</th></tr>`;
  for (let i = 0; i < three.snapshots.length; i++) {
    html += `<tr><th style="vertical-align:top">${three.snapshots[i]!.label}</th>${cell(three.snapshots[i]!)}${cell(babylon.snapshots[i]!)}</tr>`;
  }
  html += `</table></body></html>`;
  return html;
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  const three = await snapEngine("three");
  const babylon = await snapEngine("babylon");
  const md = buildReport(three, babylon);
  const html = buildHtmlReport(three, babylon);
  writeFileSync(join(OUT, "report.md"), md);
  writeFileSync(join(OUT, "index.html"), html);
  console.log(`\nReport written to ${OUT}/report.md and ${OUT}/index.html`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
