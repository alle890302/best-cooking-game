// world.js — the whole game state and its rules: the cook, the stations, the
// ingredient pipeline (pantry -> chop -> wok -> plate -> serve), the order
// board, the shift timer, combos and scoring. One job: the simulation.
import {
  CHOP_SECONDS,
  WASH_SECONDS,
  COOK_SECONDS,
  BURN_SECONDS,
  CLEAN_PLATES_START,
  MAX_CLEAN_PLATES,
  MAX_TICKETS,
  TICKET_PATIENCE,
  SPAWN_FIRST_AT,
  SPAWN_INTERVAL_EARLY,
  SPAWN_INTERVAL_MID,
  SPAWN_INTERVAL_LATE,
  RUSH_AT_SECONDS,
  SERVE_BASE,
  SERVE_TIP_MAX,
  EXPIRE_PENALTY,
  COMBO_STEP,
  COMBO_MAX,
  STAR_SCORE,
  SHIFT_SECONDS,
  COOK_SPEED,
  COOK_RADIUS,
  INGREDIENTS,
  RECIPES,
  STATIONS,
  stationById,
  VIEW_W,
  VIEW_H,
  TOP_BAR_H,
} from './config.js';
import { makeRng, pick } from './random.js';

export const SCREENS = { TITLE: 'title', PLAY: 'play', END: 'end' };

// A component: { ing, state } where state is 'raw' | 'chopped' | 'ready'.
export function makeComponent(ing) {
  return { ing, state: 'raw' };
}

// Is this component finished (ready to plate)?
export function isReady(c) {
  if (!c) return false;
  const def = INGREDIENTS[c.ing];
  if (def.prep === 'none') return c.state === 'raw';
  if (def.prep === 'chop') return c.state === 'chopped';
  if (def.prep === 'wok') return c.state === 'ready';
  return c.state === 'ready'; // chop+wok
}

// What the next prep step for this component is, or null when it is ready.
export function nextStep(c) {
  if (!c) return null;
  const def = INGREDIENTS[c.ing];
  if (def.prep === 'none') return null;
  if (def.prep === 'chop') return c.state === 'raw' ? 'chop' : null;
  if (def.prep === 'wok') return c.state === 'raw' ? 'wok' : null;
  if (c.state === 'raw') return 'chop';
  if (c.state === 'chopped') return 'wok';
  return null;
}

export function createWorld(seed = 20261125) {
  const rng = makeRng(seed);
  return {
    rng,
    screen: SCREENS.TITLE,
    paused: false,
    time: 0,
    timeLeft: SHIFT_SECONDS,
    score: 0,
    served: 0,
    expired: 0,
    combo: 0,
    bestCombo: 0,
    stars: 0,
    tickets: [],
    nextTicketAt: SPAWN_FIRST_AT,
    nextTicketId: 1,
    rushShown: 0,
    rushBanner: 0,
    // The cook: position, facing, what the hand holds, busy timers.
    cook: { x: 640, y: 430, fx: 0, fy: 1, hand: null, busy: 0, busyLabel: '' },
    moveTarget: null,
    // Wok: one item cooking. { comp, t, done } — t seconds in the wok.
    wok: null,
    // Plating counter: a plate (array of ready components) or null.
    plate: null,
    cleanPlates: CLEAN_PLATES_START,
    dirtyPlates: 0,
    wash: null, // { t } while washing
    // Transient feedback: { text, t, kind } floating messages.
    floats: [],
    // Which pantry ingredient the picker highlights (mouse hover / cycle).
    pantryPick: 'noodle',
    lastTickSecond: -1,
  };
}

export function resetWorld(world) {
  const fresh = createWorld(20261125);
  Object.assign(world, fresh);
  world.screen = SCREENS.PLAY;
}

function spawnTicket(world) {
  const recipe = pick(world.rng, RECIPES);
  world.tickets.push({
    id: world.nextTicketId++,
    recipe,
    patience: TICKET_PATIENCE,
    maxPatience: TICKET_PATIENCE,
  });
}

function spawnInterval(world) {
  if (world.time >= RUSH_AT_SECONDS[1]) return SPAWN_INTERVAL_LATE;
  if (world.time >= RUSH_AT_SECONDS[0]) return SPAWN_INTERVAL_MID;
  return SPAWN_INTERVAL_EARLY;
}

export function plateMatchesTicket(plate, recipe) {
  // The plate only ever holds finished components (interact() refuses the
  // rest), so a match is a multiset of ingredients: 'chopped' egg counts as
  // the egg a recipe needs, because isReady() says it is finished.
  if (!plate || plate.length !== recipe.needs.length) return false;
  if (!plate.every(isReady)) return false;
  const have = plate.map((c) => c.ing).sort().join('|');
  const want = recipe.needs.map((n) => n.ing).sort().join('|');
  return have === want;
}

function plateMatchesAnyTicket(world) {
  if (!world.plate) return null;
  for (const t of world.tickets) {
    if (plateMatchesTicket(world.plate, t.recipe)) return t;
  }
  return null;
}

function addFloat(world, text, kind = 'info') {
  world.floats.push({ text, t: 0, kind });
}

export function startShift(world) {
  resetWorld(world);
}

// --- Interaction -----------------------------------------------------------
// Returns a short prompt describing what E / click does at the nearest station,
// or '' when nothing is in reach. Used by render and by the input handler.
export function promptFor(world) {
  const cook = world.cook;
  if (cook.busy > 0) return cook.busyLabel;
  const st = nearestStation(world);
  if (!st) return '';
  const hand = cook.hand;
  switch (st.id) {
    case 'pantry':
      return hand ? 'Hands full — serve or trash first' : 'E: take ' + INGREDIENTS[world.pantryPick].name;
    case 'chop': {
      if (!hand) return 'Bring an ingredient to chop';
      if (nextStep(hand) !== 'chop') return 'Nothing to chop here';
      return 'E: chop the ' + INGREDIENTS[hand.ing].name;
    }
    case 'wok': {
      if (world.wok) {
        if (world.wok.done) return 'E: take it out before it burns!';
        return 'Cooking… ' + Math.ceil(COOK_SECONDS - world.wok.t) + 's';
      }
      if (!hand) return 'Bring something to cook';
      if (nextStep(hand) !== 'wok') return 'This needs chopping first';
      return 'E: put it in the wok';
    }
    case 'plate': {
      if (!world.plate) {
        if (world.cleanPlates <= 0) return 'No clean plates — wash at the sink!';
        if (!hand || !isReady(hand)) return 'Bring a finished component';
        return 'E: start a plate';
      }
      if (hand && isReady(hand)) {
        const dup = world.plate.some((c) => c.ing === hand.ing);
        if (dup) return 'That is already on the plate';
        return 'E: add ' + INGREDIENTS[hand.ing].name + ' to the plate';
      }
      if (plateMatchesAnyTicket(world)) return 'Plate is ready — take it to Serve!';
      return 'Plate needs more — check the tickets';
    }
    case 'serve': {
      const t = plateMatchesAnyTicket(world);
      if (t) return 'E: serve ' + t.recipe.name + '!';
      if (world.plate) return 'Plate does not match any ticket yet';
      return 'Bring a finished plate here';
    }
    case 'sink':
      if (world.dirtyPlates <= 0) return 'No dirty plates — keep cooking';
      return 'E: wash a plate (' + world.dirtyPlates + ' dirty)';
    case 'trash':
      if (!hand && !world.plate) return 'Nothing to throw away';
      return 'E: throw it away';
    default:
      return '';
  }
}

// The cook is near a station when within reach of its interact point.
export function nearestStation(world) {
  const cook = world.cook;
  let best = null;
  let bestD = 78;
  for (const st of STATIONS) {
    const dx = cook.x - st.ix;
    const dy = cook.y - st.iy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD) {
      bestD = d;
      best = st;
    }
  }
  return best;
}

function stationRect(st) {
  return { x: st.x, y: st.y, w: st.w, h: st.h };
}

function collide(world, nx, ny) {
  const r = COOK_RADIUS;
  if (nx < 24 + r) nx = 24 + r;
  if (nx > VIEW_W - 24 - r) nx = VIEW_W - 24 - r;
  if (ny < TOP_BAR_H + 24 + r) ny = TOP_BAR_H + 24 + r;
  if (ny > VIEW_H - 24 - r) ny = VIEW_H - 24 - r;
  for (const st of STATIONS) {
    const rc = stationRect(st);
    const cx = Math.max(rc.x, Math.min(nx, rc.x + rc.w));
    const cy = Math.max(rc.y, Math.min(ny, rc.y + rc.h));
    const dx = nx - cx;
    const dy = ny - cy;
    if (dx * dx + dy * dy < r * r) {
      if (Math.abs(dx) > Math.abs(dy)) nx = cx + (dx > 0 ? r : -r);
      else ny = cy + (dy > 0 ? r : -r);
    }
  }
  return { x: nx, y: ny };
}

function moveCook(world, dt, vx, vy) {
  const cook = world.cook;
  if (cook.busy > 0) return;
  const nx = cook.x + vx * COOK_SPEED * dt;
  const ny = cook.y + vy * COOK_SPEED * dt;
  const p = collide(world, nx, ny);
  if (p.x !== cook.x || p.y !== cook.y) {
    if (vx !== 0 || vy !== 0) {
      cook.fx = vx;
      cook.fy = vy;
    }
  }
  cook.x = p.x;
  cook.y = p.y;
}

function walkToTarget(world, dt) {
  const cook = world.cook;
  const t = world.moveTarget;
  if (!t) return;
  const dx = t.x - cook.x;
  const dy = t.y - cook.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 6) {
    world.moveTarget = null;
    if (world.moveTargetInteract) {
      world.moveTargetInteract = false;
      interact(world);
    }
    return;
  }
  moveCook(world, dt, dx / d, dy / d);
}

// Perform the context action at the nearest station. Returns a sound name.
export function interact(world) {
  const cook = world.cook;
  if (cook.busy > 0 || world.screen !== SCREENS.PLAY) return null;
  const st = nearestStation(world);
  if (!st) return null;
  const hand = cook.hand;
  switch (st.id) {
    case 'pantry': {
      if (hand) return null;
      cook.hand = makeComponent(world.pantryPick);
      return 'pickup';
    }
    case 'chop': {
      if (!hand || nextStep(hand) !== 'chop') return null;
      cook.busy = CHOP_SECONDS;
      cook.busyLabel = 'Chopping…';
      return 'chop';
    }
    case 'wok': {
      if (world.wok) {
        if (!world.wok.done) return null;
        if (hand) return null;
        cook.hand = world.wok.comp;
        world.wok = null;
        return 'pickup';
      }
      if (!hand || nextStep(hand) !== 'wok') return null;
      world.wok = { comp: hand, t: 0, done: false, burned: false };
      cook.hand = null;
      return 'sizzle';
    }
    case 'plate': {
      if (!world.plate) {
        if (world.cleanPlates <= 0) return null;
        if (!hand || !isReady(hand)) return null;
        world.plate = [hand];
        world.cleanPlates -= 1;
        cook.hand = null;
        return 'pickup';
      }
      if (hand && isReady(hand)) {
        if (world.plate.some((c) => c.ing === hand.ing)) return null;
        world.plate.push(hand);
        cook.hand = null;
        return 'pickup';
      }
      return null;
    }
    case 'serve': {
      const t = plateMatchesAnyTicket(world);
      if (!t) return null;
      serveTicket(world, t);
      return 'serve';
    }
    case 'sink': {
      if (world.dirtyPlates <= 0 || world.wash) return null;
      world.wash = { t: 0 };
      cook.busy = WASH_SECONDS;
      cook.busyLabel = 'Washing…';
      return 'chop';
    }
    case 'trash': {
      if (hand) {
        cook.hand = null;
        return 'fail';
      }
      if (world.plate) {
        world.plate = null;
        world.cleanPlates = Math.min(world.cleanPlates + 1, MAX_CLEAN_PLATES);
        return 'fail';
      }
      return null;
    }
    default:
      return null;
  }
}

function serveTicket(world, ticket) {
  const patienceLeft = ticket.patience / ticket.maxPatience;
  const tip = Math.round(SERVE_TIP_MAX * patienceLeft);
  world.combo += 1;
  world.bestCombo = Math.max(world.bestCombo, world.combo);
  const mult = Math.min(1 + COMBO_STEP * (world.combo - 1), COMBO_MAX);
  const gained = Math.round((SERVE_BASE + tip) * mult);
  world.score += gained;
  world.served += 1;
  world.tickets = world.tickets.filter((t) => t.id !== ticket.id);
  world.plate = null;
  world.dirtyPlates += 1;
  addFloat(world, '+' + gained + '  ' + ticket.recipe.name, 'good');
  if (world.combo >= 2) addFloat(world, 'COMBO x' + mult.toFixed(2).replace(/\.?0+$/, ''), 'combo');
}

function finishBusy(world) {
  const cook = world.cook;
  const label = cook.busyLabel;
  cook.busy = 0;
  cook.busyLabel = '';
  if (label === 'Chopping…' && cook.hand) {
    cook.hand.state = 'chopped';
  }
  if (label === 'Washing…') {
    world.dirtyPlates -= 1;
    world.cleanPlates = Math.min(world.cleanPlates + 1, MAX_CLEAN_PLATES);
    world.wash = null;
  }
}

// --- Per-frame update ------------------------------------------------------
export function update(world, dt, input, audio) {
  if (world.screen === SCREENS.TITLE) {
    if (input.consumePress('enter', ' ', 'e')) {
      audio.unlock();
      startShift(world);
      audio.ding();
    }
    const click = input.consumeClick();
    if (click) {
      audio.unlock();
      startShift(world);
      audio.ding();
    }
    return null;
  }

  if (world.screen === SCREENS.END) {
    if (input.consumePress('r', 'enter', ' ')) {
      startShift(world);
      audio.ding();
    }
    const click = input.consumeClick();
    if (click) {
      startShift(world);
      audio.ding();
    }
    return null;
  }

  // Playing.
  if (input.consumePress('p')) {
    world.paused = !world.paused;
    return null;
  }
  if (input.consumePress('m')) {
    audio.toggle();
    return null;
  }
  if (world.paused) {
    input.endFrame();
    return null;
  }

  let sound = null;
  const mv = input.moveVector();
  if (mv.x !== 0 || mv.y !== 0) {
    world.moveTarget = null;
    moveCook(world, dt, mv.x, mv.y);
  } else {
    walkToTarget(world, dt);
  }

  const click = input.consumeClick();
  if (click) {
    // Clicking a pantry ingredient icon picks it; clicking a station walks to it.
    const picked = pantryClick(world, click);
    if (picked) {
      sound = interact(world);
    } else {
      const st = stationAtPoint(click.x, click.y);
      if (st) {
        world.moveTarget = { x: st.ix, y: st.iy };
        world.moveTargetInteract = true;
      } else {
        world.moveTarget = { x: click.x, y: Math.max(click.y, TOP_BAR_H + 30) };
        world.moveTargetInteract = false;
      }
    }
  }
  if (input.consumePress('e', ' ')) {
    sound = interact(world);
  }

  // Busy work (chopping / washing) counts down.
  if (world.cook.busy > 0) {
    world.cook.busy -= dt;
    if (world.cook.busy <= 0) finishBusy(world);
  }

  // Wok cooks on its own; burns if forgotten.
  if (world.wok) {
    world.wok.t += dt;
    if (!world.wok.done && world.wok.t >= COOK_SECONDS) {
      world.wok.done = true;
      world.wok.comp.state = 'ready';
      audio.ding();
    }
    if (!world.wok.burned && world.wok.t >= BURN_SECONDS) {
      world.wok.burned = true;
      world.wok.comp = { ing: world.wok.comp.ing, state: 'burned' };
      addFloat(world, 'Burned! Trash it.', 'bad');
      audio.fail();
    }
  }

  // Shift clock.
  world.time += dt;
  world.timeLeft = Math.max(0, SHIFT_SECONDS - world.time);
  const sec = Math.ceil(world.timeLeft);
  if (sec <= 10 && sec !== world.lastTickSecond && world.timeLeft > 0) {
    world.lastTickSecond = sec;
    audio.tick();
  }

  // Rush banners.
  for (let i = 0; i < RUSH_AT_SECONDS.length; i++) {
    if (world.time >= RUSH_AT_SECONDS[i] && world.rushShown <= i) {
      world.rushShown = i + 1;
      world.rushBanner = 2.5;
      addFloat(world, 'RUSH HOUR!', 'rush');
      audio.ding();
    }
  }
  if (world.rushBanner > 0) world.rushBanner -= dt;

  // New tickets.
  if (world.time >= world.nextTicketAt && world.tickets.length < MAX_TICKETS) {
    spawnTicket(world);
    world.nextTicketAt = world.time + spawnInterval(world);
    audio.ding();
  }

  // Ticket patience drains; expired tickets break the combo.
  for (const t of [...world.tickets]) {
    t.patience -= dt;
    if (t.patience <= 0) {
      world.tickets = world.tickets.filter((x) => x.id !== t.id);
      world.expired += 1;
      world.combo = 0;
      world.score = Math.max(0, world.score - EXPIRE_PENALTY);
      addFloat(world, 'Order expired! -' + EXPIRE_PENALTY, 'bad');
      audio.fail();
    }
  }

  // Floating messages fade.
  for (const f of world.floats) f.t += dt;
  world.floats = world.floats.filter((f) => f.t < 2.2);

  // Shift over.
  if (world.timeLeft <= 0) {
    world.screen = SCREENS.END;
    world.stars = STAR_SCORE.filter((s) => world.score >= s).length;
    audio.serve();
  }

  return sound;
}

function stationAtPoint(x, y) {
  for (const st of STATIONS) {
    if (x >= st.x && x <= st.x + st.w && y >= st.y && y <= st.y + st.h) return st;
  }
  return null;
}

// Pantry ingredient icons are drawn in a row inside the pantry station.
// Clicking one selects it (and takes it if the cook is in reach).
function pantryClick(world, click) {
  const st = stationById('pantry');
  if (!st) return false;
  const names = Object.keys(INGREDIENTS);
  const iw = st.w / names.length;
  for (let i = 0; i < names.length; i++) {
    const x0 = st.x + i * iw;
    if (click.x >= x0 && click.x < x0 + iw && click.y >= st.y && click.y <= st.y + st.h) {
      world.pantryPick = names[i];
      const cook = world.cook;
      const dx = cook.x - st.ix;
      const dy = cook.y - st.iy;
      if (Math.sqrt(dx * dx + dy * dy) < 78) return true;
      world.moveTarget = { x: st.ix, y: st.iy };
      world.moveTargetInteract = true;
      return true;
    }
  }
  return false;
}
