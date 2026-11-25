// render.js — every pixel of The Sizzling Lantern, drawn on one canvas with
// flat shapes and the lantern palette. No images, no fonts to load, no network.
// One job: make the game readable at a glance.
import {
  VIEW_W,
  VIEW_H,
  TOP_BAR_H,
  PALETTE,
  INGREDIENTS,
  RECIPES,
  STATIONS,
  stationById,
  SHIFT_SECONDS,
  COOK_SECONDS,
  BURN_SECONDS,
  componentLabel,
} from './config.js';
import { SCREENS, isReady, nearestStation, promptFor, plateMatchesTicket } from './world.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, align = 'left', weight = 'bold') {
  ctx.fillStyle = color;
  ctx.font = weight + ' ' + size + 'px sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

function bar(ctx, x, y, w, h, frac, fill, bg = 'rgba(0,0,0,0.45)') {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}

// A small food icon: a coloured disc with the ingredient's initial.
export function drawIngredientIcon(ctx, ing, x, y, r, state) {
  const def = INGREDIENTS[ing];
  ctx.fillStyle = def.color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, def.name[0], x, y + 1, Math.round(r * 1.1), '#2b2118', 'center');
  if (state === 'chopped') {
    ctx.strokeStyle = '#2b2118';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.6, y - r * 0.6);
    ctx.lineTo(x + r * 0.6, y + r * 0.6);
    ctx.moveTo(x + r * 0.6, y - r * 0.6);
    ctx.lineTo(x - r * 0.6, y + r * 0.6);
    ctx.stroke();
  }
  if (state === 'burned') {
    ctx.fillStyle = 'rgba(20,10,5,0.75)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTicket(ctx, ticket, x, y, w, h) {
  const frac = ticket.patience / ticket.maxPatience;
  const urgent = frac < 0.25;
  ctx.fillStyle = PALETTE.ticket;
  rr(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = urgent ? PALETTE.danger : 'rgba(0,0,0,0.25)';
  ctx.lineWidth = urgent ? 3 : 1.5;
  ctx.stroke();
  ctx.fillStyle = ticket.recipe.color;
  ctx.fillRect(x, y, 8, h);
  text(ctx, ticket.recipe.name, x + 16, y + 16, 14, PALETTE.ticketText);
  let cx = x + 16;
  for (const need of ticket.recipe.needs) {
    drawIngredientIcon(ctx, need.ing, cx + 10, y + 40, 11, need.state);
    cx += 28;
  }
  bar(ctx, x + 10, y + h - 12, w - 20, 6, frac, urgent ? PALETTE.danger : PALETTE.green);
  text(ctx, Math.ceil(ticket.patience) + 's', x + w - 8, y + 16, 12, urgent ? PALETTE.danger : PALETTE.ticketText, 'right');
}

function drawStation(ctx, world, st) {
  const near = world.screen === SCREENS.PLAY && nearestStation(world) === st;
  ctx.fillStyle = st.color;
  rr(ctx, st.x, st.y, st.w, st.h, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.counterTop;
  ctx.fillRect(st.x + 4, st.y + 4, st.w - 8, 10);
  ctx.strokeStyle = near ? PALETTE.gold : 'rgba(0,0,0,0.3)';
  ctx.lineWidth = near ? 3 : 1.5;
  rr(ctx, st.x, st.y, st.w, st.h, 10);
  ctx.stroke();
  text(ctx, st.name, st.x + st.w / 2, st.y + 26, 15, PALETTE.text, 'center');

  if (st.id === 'pantry') {
    const names = Object.keys(INGREDIENTS);
    const iw = st.w / names.length;
    names.forEach((ing, i) => {
      const cx = st.x + i * iw + iw / 2;
      const picked = world.pantryPick === ing;
      if (picked) {
        ctx.fillStyle = 'rgba(242,177,52,0.35)';
        ctx.fillRect(st.x + i * iw + 2, st.y + 40, iw - 4, 44);
      }
      drawIngredientIcon(ctx, ing, cx, st.y + 56, 13, 'raw');
      text(ctx, INGREDIENTS[ing].name, cx, st.y + 78, 9, PALETTE.text, 'center', 'normal');
    });
  }
  if (st.id === 'wok' && world.wok) {
    const w = world.wok;
    const cx = st.x + st.w / 2;
    const cy = st.y + 62;
    ctx.fillStyle = w.burned ? '#1a0d08' : '#222';
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
    if (!w.burned) {
      ctx.fillStyle = PALETTE.wokGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, 14 + Math.sin(world.time * 9) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    drawIngredientIcon(ctx, w.comp.ing, cx, cy, 11, w.comp.state);
    const frac = w.done ? 1 : w.t / COOK_SECONDS;
    bar(ctx, st.x + 20, st.y + st.h - 16, st.w - 40, 7, frac, w.burned ? PALETTE.danger : PALETTE.gold);
    text(ctx, w.burned ? 'BURNED!' : w.done ? 'READY!' : 'cooking…', cx, st.y + st.h - 26, 11, w.burned ? PALETTE.danger : PALETTE.text, 'center');
  }
  if (st.id === 'wok' && !world.wok) {
    text(ctx, 'empty — bring food', st.x + st.w / 2, st.y + 62, 12, PALETTE.dim, 'center', 'normal');
  }
  if (st.id === 'plate') {
    if (world.plate) {
      ctx.fillStyle = PALETTE.plate;
      ctx.beginPath();
      ctx.ellipse(st.x + st.w / 2, st.y + 62, 52, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      world.plate.forEach((c, i) => {
        drawIngredientIcon(ctx, c.ing, st.x + 50 + i * 34, st.y + 62, 12, c.state);
      });
    } else {
      text(ctx, world.cleanPlates + ' clean plates', st.x + st.w / 2, st.y + 62, 12, PALETTE.text, 'center', 'normal');
    }
  }
  if (st.id === 'sink') {
    text(ctx, world.dirtyPlates + ' dirty plate' + (world.dirtyPlates === 1 ? '' : 's'), st.x + st.w / 2, st.y + 56, 12, PALETTE.text, 'center', 'normal');
    if (world.wash) {
      bar(ctx, st.x + 20, st.y + st.h - 16, st.w - 40, 7, 1 - world.wash.t / 1.5, '#7fb8d8');
    }
  }
  if (st.id === 'serve') {
    text(ctx, 'WINDOW', st.x + st.w / 2, st.y + 56, 13, PALETTE.text, 'center');
    text(ctx, 'serve matching plates', st.x + st.w / 2, st.y + 76, 10, PALETTE.dim, 'center', 'normal');
  }
  if (st.id === 'trash') {
    text(ctx, 'toss it', st.x + st.w / 2, st.y + 62, 12, PALETTE.dim, 'center', 'normal');
  }
  if (st.id === 'chop') {
    text(ctx, 'chop raw food', st.x + st.w / 2, st.y + 62, 12, PALETTE.dim, 'center', 'normal');
  }
}

function drawCook(ctx, world) {
  const c = world.cook;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 16, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body (apron) + head.
  ctx.fillStyle = PALETTE.apron;
  rr(ctx, c.x - 14, c.y - 6, 28, 26, 8);
  ctx.fill();
  ctx.fillStyle = '#d98a4a';
  ctx.beginPath();
  ctx.arc(c.x, c.y - 16, 13, 0, Math.PI * 2);
  ctx.fill();
  // Chef hat.
  ctx.fillStyle = '#f5f0e6';
  ctx.beginPath();
  ctx.arc(c.x, c.y - 26, 10, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(c.x - 10, c.y - 28, 20, 5);
  // Eyes look the way the cook faces.
  ctx.fillStyle = '#2b2118';
  ctx.beginPath();
  ctx.arc(c.x + c.fx * 4 - 4, c.y - 16 + c.fy * 2, 2, 0, Math.PI * 2);
  ctx.arc(c.x + c.fx * 4 + 4, c.y - 16 + c.fy * 2, 2, 0, Math.PI * 2);
  ctx.fill();
  // Held ingredient floats above the hand.
  if (c.hand) {
    drawIngredientIcon(ctx, c.hand.ing, c.x + 22, c.y - 22, 13, c.hand.state);
    text(ctx, componentLabel(c.hand.ing, c.hand.state), c.x + 22, c.y - 42, 10, PALETTE.text, 'center', 'normal');
  }
  // Busy progress ring.
  if (c.busy > 0) {
    const frac = 1 - c.busy / (c.busyLabel === 'Washing…' ? 1.5 : 1.4);
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(c.x, c.y - 16, 24, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    text(ctx, c.busyLabel, c.x, c.y + 34, 12, PALETTE.gold, 'center');
  }
  // Move target marker.
  if (world.moveTarget) {
    ctx.strokeStyle = 'rgba(242,177,52,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(world.moveTarget.x, world.moveTarget.y, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawTopBar(ctx, world) {
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(0, 0, VIEW_W, TOP_BAR_H);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(0, TOP_BAR_H - 4, VIEW_W, 4);
  text(ctx, 'THE SIZZLING LANTERN', 24, 30, 26, PALETTE.gold);
  text(ctx, 'night-market noodle stall', 24, 56, 13, PALETTE.dim, 'left', 'normal');

  // Order board: tickets across the middle.
  let tx = 340;
  for (const t of world.tickets) {
    drawTicket(ctx, t, tx, 10, 190, 76);
    tx += 200;
  }
  if (world.tickets.length === 0) {
    text(ctx, 'No orders — catch your breath!', 360, 48, 14, PALETTE.dim, 'left', 'normal');
  }

  // Timer, score, combo on the right.
  const mm = Math.floor(world.timeLeft / 60);
  const ss = Math.floor(world.timeLeft % 60).toString().padStart(2, '0');
  const lowTime = world.timeLeft <= 30;
  text(ctx, mm + ':' + ss, VIEW_W - 24, 30, 30, lowTime ? PALETTE.danger : PALETTE.text, 'right');
  bar(ctx, VIEW_W - 184, 52, 160, 8, world.timeLeft / SHIFT_SECONDS, lowTime ? PALETTE.danger : PALETTE.gold);
  text(ctx, 'SCORE ' + world.score, VIEW_W - 24, 76, 15, PALETTE.text, 'right');
  if (world.combo >= 2) {
    const mult = Math.min(1 + 0.25 * (world.combo - 1), 3);
    text(ctx, 'COMBO x' + mult.toFixed(2).replace(/\.?0+$/, '') + '  (' + world.combo + ')', VIEW_W - 200, 76, 14, PALETTE.gold, 'right');
  }
}

function drawFloor(ctx, world) {
  ctx.fillStyle = PALETTE.floor;
  ctx.fillRect(0, TOP_BAR_H, VIEW_W, VIEW_H - TOP_BAR_H);
  ctx.strokeStyle = PALETTE.floorLine;
  ctx.lineWidth = 2;
  for (let y = TOP_BAR_H + 48; y < VIEW_H; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW_W, y);
    ctx.stroke();
  }
  // Lantern glow in the corners.
  const glow = ctx.createRadialGradient(120, 180, 10, 120, 180, 220);
  glow.addColorStop(0, 'rgba(242,177,52,0.20)');
  glow.addColorStop(1, 'rgba(242,177,52,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, TOP_BAR_H, 340, 340);
  const glow2 = ctx.createRadialGradient(1160, 180, 10, 1160, 180, 220);
  glow2.addColorStop(0, 'rgba(242,177,52,0.20)');
  glow2.addColorStop(1, 'rgba(242,177,52,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(940, TOP_BAR_H, 340, 340);
  // Recipe cheat-sheet on the back wall.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, 480, 116, 320, 54, 8);
  ctx.fill();
  text(ctx, 'RECIPES', 640, 132, 11, PALETTE.gold, 'center');
  const parts = RECIPES.map((r) => r.name + ': ' + r.needs.map((n) => INGREDIENTS[n.ing].name).join('+'));
  text(ctx, parts[0], 640, 148, 11, PALETTE.text, 'center', 'normal');
  text(ctx, parts[1] + '  •  ' + parts[2], 640, 164, 11, PALETTE.text, 'center', 'normal');
}

function drawFloats(ctx, world) {
  world.floats.forEach((f, i) => {
    const alpha = f.t < 1.8 ? 1 : 1 - (f.t - 1.8) / 0.4;
    const color = f.kind === 'good' ? PALETTE.green : f.kind === 'bad' ? PALETTE.danger : f.kind === 'combo' ? PALETTE.gold : PALETTE.text;
    ctx.globalAlpha = alpha;
    text(ctx, f.text, VIEW_W / 2, 210 + i * 26 - f.t * 14, f.kind === 'rush' ? 30 : 20, color, 'center');
    ctx.globalAlpha = 1;
  });
}

function drawPrompt(ctx, world) {
  const prompt = promptFor(world);
  if (!prompt) return;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, VIEW_W / 2 - 320, VIEW_H - 44, 640, 32, 8);
  ctx.fill();
  text(ctx, prompt, VIEW_W / 2, VIEW_H - 27, 15, PALETTE.text, 'center', 'normal');
}

function drawTitle(ctx, world) {
  ctx.fillStyle = 'rgba(20,12,6,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // A big lantern.
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(640, 150, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c92f1e';
  ctx.beginPath();
  ctx.arc(640, 150, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.gold;
  text(ctx, '火', 640, 152, 44, PALETTE.gold, 'center');
  text(ctx, 'THE SIZZLING LANTERN', 640, 260, 44, PALETTE.gold, 'center');
  text(ctx, 'a night-market noodle stall', 640, 300, 20, PALETTE.text, 'center', 'normal');
  text(ctx, 'WASD / arrows to walk  •  E or click to use a station  •  P pause  •  M mute', 640, 360, 16, PALETTE.dim, 'center', 'normal');
  text(ctx, 'Chop it, wok it, plate it, serve it — before the ticket runs out!', 640, 392, 16, PALETTE.text, 'center', 'normal');
  text(ctx, 'Serve fast for tips. Chain serves for a combo. Wash your plates.', 640, 420, 16, PALETTE.text, 'center', 'normal');
  const pulse = 0.6 + 0.4 * Math.sin((world.anim || 0) * 4);
  ctx.globalAlpha = pulse;
  text(ctx, 'Press ENTER or click to start your 3-minute shift', 640, 500, 22, PALETTE.gold, 'center');
  ctx.globalAlpha = 1;
}

function drawEnd(ctx, world) {
  ctx.fillStyle = 'rgba(20,12,6,0.85)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, 'SHIFT OVER!', 640, 150, 44, PALETTE.gold, 'center');
  text(ctx, 'Final score: ' + world.score, 640, 220, 28, PALETTE.text, 'center');
  text(ctx, 'Dishes served: ' + world.served + '    Orders lost: ' + world.expired + '    Best combo: x' + world.bestCombo, 640, 264, 18, PALETTE.text, 'center', 'normal');
  for (let i = 0; i < 3; i++) {
    const filled = i < world.stars;
    ctx.fillStyle = filled ? PALETTE.gold : 'rgba(255,255,255,0.18)';
    const cx = 640 + (i - 1) * 90;
    const cy = 330;
    ctx.beginPath();
    for (let p = 0; p < 10; p++) {
      const r = p % 2 === 0 ? 34 : 15;
      const a = -Math.PI / 2 + (p * Math.PI) / 5;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (p === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  const verdict = world.stars === 3 ? 'A legendary shift — the lanterns bow to you!' : world.stars === 2 ? 'A solid shift — the regulars are happy.' : world.stars === 1 ? 'You survived the rush. The wok awaits.' : 'Rough night. The wok forgives — try again.';
  text(ctx, verdict, 640, 410, 18, PALETTE.text, 'center', 'normal');
  const pulse = 0.6 + 0.4 * Math.sin((world.anim || 0) * 4);
  ctx.globalAlpha = pulse;
  text(ctx, 'Press R to cook again', 640, 480, 22, PALETTE.gold, 'center');
  ctx.globalAlpha = 1;
}

export function render(ctx, world) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawFloor(ctx, world);
  for (const st of STATIONS) drawStation(ctx, world, st);
  drawCook(ctx, world);
  drawTopBar(ctx, world);
  drawFloats(ctx, world);
  if (world.rushBanner > 0) {
    ctx.globalAlpha = Math.min(1, world.rushBanner);
    text(ctx, 'RUSH HOUR — orders incoming!', VIEW_W / 2, 120, 30, PALETTE.danger, 'center');
    ctx.globalAlpha = 1;
  }
  if (world.screen === SCREENS.PLAY && !world.paused) drawPrompt(ctx, world);
  if (world.paused) {
    ctx.fillStyle = 'rgba(20,12,6,0.7)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, 'PAUSED — press P to keep cooking', VIEW_W / 2, VIEW_H / 2, 28, PALETTE.text, 'center');
  }
  if (world.screen === SCREENS.TITLE) drawTitle(ctx, world);
  if (world.screen === SCREENS.END) drawEnd(ctx, world);
}
