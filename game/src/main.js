// main.js — boot and the game loop: one requestAnimationFrame, fixed-clamp dt,
// error + resource hooks so headless checks can read them from the DOM.
// One job: run the game.
import { VIEW_W, VIEW_H } from './config.js';
import { createWorld, update, interact, nearestStation, SCREENS } from './world.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { applyShot, runSelfTest } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e.error || 'error')));
window.addEventListener('unhandledrejection', (e) => errors.push('rejection: ' + String(e.reason)));

const input = createInput(canvas);
const audio = createAudio();
const world = createWorld(20261125);
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';

if (shot) applyShot(world, shot);

// One immediate draw so a screenshot taken at any moment shows the state,
// even before the first animation frame.
render(ctx, world);

if (selftest) {
  runSelfTest(world, update, interact, nearestStation);
  render(ctx, world);
  document.getElementById('diag').textContent =
    'errors=' + errors.length + ' resources=' + performance.getEntriesByType('resource').length;
} else {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    world.anim = (world.anim || 0) + dt; // cosmetic clock; the shift clock lives in update
    const sound = update(world, dt, input, audio);
    if (sound === 'chop') audio.chop();
    else if (sound === 'pickup') audio.pickup();
    else if (sound === 'sizzle') audio.sizzle();
    else if (sound === 'serve') audio.serve();
    else if (sound === 'fail') audio.fail();
    else if (sound === 'ding') audio.ding();
    input.endFrame();
    render(ctx, world);
    document.getElementById('diag').textContent =
      'errors=' + errors.length + ' resources=' + performance.getEntriesByType('resource').length;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Expose the live state for the maker's own debugging (not used by the game).
window.__lantern = { world, errors };
