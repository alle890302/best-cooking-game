// shots.js — deterministic states for the maker's screenshots (?shot=start,
// ?shot=play, ?shot=assemble, ?shot=end) and a headless self-test (?selftest=1)
// that plays the full pipeline with the same code paths as real input and
// reports the result into document.title. One job: reproducible evidence.
import { createWorld, SCREENS, resetWorld, makeComponent } from './world.js';
import { RECIPES, stationById } from './config.js';

function ticket(world, recipeId, patience) {
  const recipe = RECIPES.find((r) => r.id === recipeId);
  return { id: world.nextTicketId++, recipe, patience, maxPatience: 45 };
}

// Build a fixed mid-shift scene: three tickets, the cook at the wok holding a
// cooked noodle, meat sizzling, a plate with one component on the counter.
export function applyShot(world, name) {
  resetWorld(world);
  if (name === 'start') {
    world.screen = SCREENS.TITLE;
    world.time = 0.5;
    return;
  }
  if (name === 'play') {
    world.time = 84;
    world.timeLeft = 96;
    world.score = 340;
    world.combo = 2;
    world.bestCombo = 3;
    world.served = 3;
    world.tickets = [
      ticket(world, 'noodles', 38),
      ticket(world, 'ricebox', 22),
      ticket(world, 'skewer', 12),
    ];
    const wok = stationById('wok');
    world.cook.x = wok.ix + 30;
    world.cook.y = wok.iy;
    world.cook.fx = -1;
    world.cook.fy = 0;
    world.cook.hand = { ing: 'noodle', state: 'ready' };
    world.wok = { comp: { ing: 'meat', state: 'chopped' }, t: 1.6, done: false, burned: false };
    world.plate = [{ ing: 'egg', state: 'ready' }];
    world.cleanPlates = 2;
    world.dirtyPlates = 1;
    return;
  }
  if (name === 'assemble') {
    world.time = 119;
    world.timeLeft = 61;
    world.score = 480;
    world.combo = 3;
    world.bestCombo = 3;
    world.served = 4;
    world.tickets = [
      ticket(world, 'ricebox', 30),
      ticket(world, 'noodles', 18),
    ];
    const plate = stationById('plate');
    world.cook.x = plate.ix - 30;
    world.cook.y = plate.iy;
    world.cook.fx = 1;
    world.cook.fy = 0;
    world.cook.hand = { ing: 'veg', state: 'ready' };
    world.plate = [
      { ing: 'rice', state: 'ready' },
      { ing: 'meat', state: 'ready' },
    ];
    world.cleanPlates = 1;
    world.dirtyPlates = 2;
    return;
  }
  if (name === 'end') {
    world.screen = SCREENS.END;
    world.time = 180;
    world.timeLeft = 0;
    world.score = 620;
    world.served = 7;
    world.expired = 1;
    world.bestCombo = 4;
    world.stars = 3;
    return;
  }
}

// Play the pipeline headlessly: teleport the cook to each station and call the
// same interact() the keyboard uses, stepping the world with fixed dt.
// Serves one Lantern Noodles, then reports into document.title.
export function runSelfTest(world, update, interact, nearestStation) {
  const log = [];
  function step(n) {
    for (let i = 0; i < n; i++) update(world, 1 / 60, { consumePress: () => null, consumeClick: () => null, moveVector: () => ({ x: 0, y: 0 }), endFrame: () => {} }, { unlock() {}, ding() {}, tick() {}, fail() {}, sizzle() {}, serve() {}, chop() {}, pickup() {}, toggle: () => true });
  }
  function go(stationId) {
    const st = stationById(stationId);
    world.cook.x = st.ix;
    world.cook.y = st.iy;
    world.moveTarget = null;
  }
  function act(stationId) {
    go(stationId);
    const r = interact(world);
    return r;
  }
  try {
    world.screen = SCREENS.PLAY;
    world.tickets = [ticket(world, 'noodles', 45)];
    world.nextTicketAt = 9999;
    // 1. Take a noodle from the pantry.
    world.pantryPick = 'noodle';
    act('pantry');
    log.push('hand after pantry: ' + (world.cook.hand ? world.cook.hand.ing : 'empty'));
    // 2. Wok it: 3s of cooking.
    act('wok');
    step(200);
    log.push('wok done: ' + !!(world.wok && world.wok.done));
    act('wok');
    log.push('hand after wok: ' + (world.cook.hand ? world.cook.hand.ing + '/' + world.cook.hand.state : 'empty'));
    // 3. Plate it.
    act('plate');
    log.push('plate: ' + (world.plate ? world.plate.length : 0) + ' cleanPlates: ' + world.cleanPlates);
    // 4. Take an egg, chop it (1.4s busy).
    world.pantryPick = 'egg';
    act('pantry');
    act('chop');
    step(100);
    log.push('hand after chop: ' + (world.cook.hand ? world.cook.hand.ing + '/' + world.cook.hand.state : 'empty'));
    // 5. Add the egg to the plate and serve.
    act('plate');
    log.push('plate size: ' + (world.plate ? world.plate.length : 0));
    const before = world.score;
    act('serve');
    log.push('served: ' + world.served + ' score ' + before + ' -> ' + world.score + ' combo ' + world.combo);
    // 6. Movement sanity: hold right for 1s through the real update path.
    world.cook.x = 640;
    world.cook.y = 430;
    const x0 = world.cook.x;
    const mover = {
      consumePress: () => null,
      consumeClick: () => null,
      moveVector: () => ({ x: 1, y: 0 }),
      endFrame: () => {},
    };
    const silent = { unlock() {}, ding() {}, tick() {}, fail() {}, sizzle() {}, serve() {}, chop() {}, pickup() {}, toggle: () => true };
    for (let i = 0; i < 60; i++) update(world, 1 / 60, mover, silent);
    const moved = world.cook.x - x0;
    const inside = world.cook.x > 24 && world.cook.x < 1256 && world.cook.y > 96 && world.cook.y < 696;
    log.push('movement: +' + Math.round(moved) + 'px in 1s, inside bounds: ' + inside);
    const ok = world.served === 1 && world.score > before && moved > 100 && inside;
    document.title = 'SELFTEST ' + (ok ? 'PASS' : 'FAIL') + ' | ' + log.join(' | ');
    const node = document.getElementById('selftest');
    if (node) node.textContent = document.title;
  } catch (e) {
    document.title = 'SELFTEST ERROR ' + String(e && e.message ? e.message : e);
    const node = document.getElementById('selftest');
    if (node) node.textContent = document.title;
  }
}
