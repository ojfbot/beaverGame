// Cartoon-splat game over overlay. DOM-based (not WebGL) so the styling and
// SVG render crisply at any resolution. Try Again does a full page reload —
// simplest possible reset and avoids partial-state bugs.

export interface GameOverHandles {
  show(): void;
  isShowing(): boolean;
  destroy(): void;
}

const SVG_SPLAT = `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <!-- splat outline -->
  <path d="M40,120
           Q30,100 50,90
           Q35,75 60,70
           Q60,50 85,55
           Q95,40 115,55
           Q140,45 145,70
           Q170,75 160,95
           Q175,115 155,125
           Q160,150 130,150
           Q120,170 95,160
           Q75,170 65,150
           Q35,150 40,120 Z"
        fill="#7a4a2a" stroke="#3a2412" stroke-width="3" stroke-linejoin="round"/>
  <!-- two flat eyes (X = knocked out) -->
  <g stroke="#1a0e06" stroke-width="3.5" stroke-linecap="round">
    <line x1="78" y1="100" x2="92" y2="114"/>
    <line x1="78" y1="114" x2="92" y2="100"/>
    <line x1="118" y1="100" x2="132" y2="114"/>
    <line x1="118" y1="114" x2="132" y2="100"/>
  </g>
  <!-- tongue -->
  <ellipse cx="100" cy="135" rx="9" ry="5" fill="#d77b7b" stroke="#1a0e06" stroke-width="2.5"/>
  <!-- two front teeth -->
  <rect x="93" y="124" width="5" height="9" rx="1" fill="#fff8e2" stroke="#1a0e06" stroke-width="1.5"/>
  <rect x="102" y="124" width="5" height="9" rx="1" fill="#fff8e2" stroke="#1a0e06" stroke-width="1.5"/>
  <!-- tail flop -->
  <path d="M155,140 Q180,150 175,170 Q165,165 158,155 Z"
        fill="#5a3520" stroke="#3a2412" stroke-width="2.5" stroke-linejoin="round"/>
</svg>
`;

const STYLES = `
#beaver-gameover {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(20, 30, 22, 0.78);
  display: flex; align-items: center; justify-content: center;
  font-family: system-ui, -apple-system, sans-serif;
  color: #f4ead6;
  user-select: none;
  animation: bg-fade-in 360ms ease-out both;
}
@keyframes bg-fade-in { from { opacity: 0 } to { opacity: 1 } }
#beaver-gameover .card {
  background: #d8e4d2; color: #2a3a28;
  padding: 36px 44px 32px;
  border-radius: 22px;
  box-shadow: 0 18px 50px rgba(0,0,0,0.4), 0 2px 0 rgba(255,255,255,0.6) inset;
  text-align: center;
  max-width: 440px;
  animation: card-pop 480ms cubic-bezier(.2,1.4,.5,1) both;
}
@keyframes card-pop {
  0% { transform: scale(0.6) rotate(-6deg); opacity: 0 }
  100% { transform: scale(1) rotate(0); opacity: 1 }
}
#beaver-gameover svg {
  width: 200px; height: 200px;
  display: block; margin: 0 auto 12px;
  animation: splat-wobble 1.4s ease-in-out infinite;
}
@keyframes splat-wobble {
  0%, 100% { transform: rotate(-2deg) }
  50% { transform: rotate(2deg) }
}
#beaver-gameover h1 {
  font-size: 28px; margin: 8px 0 6px; font-weight: 800; letter-spacing: -0.5px;
}
#beaver-gameover p {
  font-size: 16px; line-height: 1.45; margin: 0 0 22px; color: #4a5a48;
}
#beaver-gameover button {
  font: inherit; font-weight: 700; font-size: 17px;
  background: #4a8a55; color: #fffaf0;
  border: none; padding: 12px 28px; border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 0 #2a5a32, 0 8px 18px rgba(0,0,0,0.18);
  transition: transform 60ms ease, box-shadow 60ms ease;
}
#beaver-gameover button:hover { transform: translateY(-1px); box-shadow: 0 5px 0 #2a5a32, 0 10px 22px rgba(0,0,0,0.22); }
#beaver-gameover button:active { transform: translateY(2px); box-shadow: 0 2px 0 #2a5a32, 0 4px 10px rgba(0,0,0,0.18); }
`;

const MESSAGES = [
  { h: "Oof!", p: "That tree had it in for you. Want another go?" },
  { h: "Whoops, timber.", p: "Even the best beavers get squished sometimes." },
  { h: "Splat.", p: "Tail tip: the red stripe on the ground means RUN." },
  { h: "Owie.", p: "Double-tap any direction to dash out of the way!" },
];

export function createGameOver(): GameOverHandles {
  let el: HTMLDivElement | null = null;
  let styleTag: HTMLStyleElement | null = null;
  let showing = false;

  function show(): void {
    if (showing) return;
    showing = true;
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.textContent = STYLES;
      document.head.appendChild(styleTag);
    }
    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]!;
    el = document.createElement("div");
    el.id = "beaver-gameover";
    el.innerHTML = `
      <div class="card">
        ${SVG_SPLAT}
        <h1>${msg.h}</h1>
        <p>${msg.p}</p>
        <button id="beaver-gameover-retry">Try Again</button>
      </div>
    `;
    document.body.appendChild(el);
    const btn = el.querySelector<HTMLButtonElement>("#beaver-gameover-retry")!;
    btn.addEventListener("click", () => location.reload());
    // Allow Enter / Space to also reload.
    el.addEventListener("keydown", (e) => {
      if (e.code === "Enter" || e.code === "Space") location.reload();
    });
    btn.focus();
  }

  return {
    show,
    isShowing(): boolean { return showing; },
    destroy(): void {
      el?.remove();
      styleTag?.remove();
      el = null;
      styleTag = null;
      showing = false;
    },
  };
}
