// input.js — keyboard (WASD / arrows + E / Space to interact, P pause, R retry,
// M mute) and mouse (click a station to walk to it and use it, click a pantry
// ingredient to take it). One job: turn hardware events into game intents.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouse = { x: 0, y: 0, clicked: false, clickedX: 0, clickedY: 0 };

  function keyName(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    return k;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
      e.preventDefault();
    }
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    mouse.x = (e.clientX - rect.left) * sx;
    mouse.y = (e.clientY - rect.top) * sy;
    mouse.clicked = true;
    mouse.clickedX = mouse.x;
    mouse.clickedY = mouse.y;
  });

  return {
    // Held-down movement vector, normalized.
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.sqrt(2);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    // True once per physical press; consumed by the caller each frame.
    consumePress(...names) {
      for (const n of names) {
        if (pressed.has(n)) {
          pressed.delete(n);
          return n;
        }
      }
      return null;
    },
    // True once per click; consumed by the caller each frame.
    consumeClick() {
      if (!mouse.clicked) return null;
      mouse.clicked = false;
      return { x: mouse.clickedX, y: mouse.clickedY };
    },
    mousePos() {
      return { x: mouse.x, y: mouse.y };
    },
    endFrame() {
      pressed.clear();
    },
  };
}
