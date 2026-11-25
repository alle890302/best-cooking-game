// config.js — every constant of The Sizzling Lantern: canvas, kitchen layout,
// ingredients, prep chains, recipes, pacing and scoring. One job: the numbers.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const TOP_BAR_H = 96;
export const FLOOR_Y = TOP_BAR_H;
export const SHIFT_SECONDS = 180;

// The cook walks this fast (px per second).
export const COOK_SPEED = 270;
export const COOK_RADIUS = 18;

// Prep times, in seconds.
export const CHOP_SECONDS = 1.4;
export const WASH_SECONDS = 1.5;
export const COOK_SECONDS = 3.0;
export const BURN_SECONDS = 6.5;

// Plates: the shared resource that forces trips to the sink.
export const CLEAN_PLATES_START = 3;
export const MAX_CLEAN_PLATES = 4;

// Orders.
export const MAX_TICKETS = 4;
export const TICKET_PATIENCE = 45;
export const SPAWN_FIRST_AT = 2;
export const SPAWN_INTERVAL_EARLY = 14;
export const SPAWN_INTERVAL_MID = 9;
export const SPAWN_INTERVAL_LATE = 6;
export const RUSH_AT_SECONDS = [60, 120];

// Scoring.
export const SERVE_BASE = 100;
export const SERVE_TIP_MAX = 50;
export const EXPIRE_PENALTY = 25;
export const COMBO_STEP = 0.25;
export const COMBO_MAX = 3;
export const STAR_SCORE = [200, 400, 600];

// Warm lantern palette: flat colours, no assets.
export const PALETTE = {
  wall: '#241a12',
  floor: '#6b4a2f',
  floorLine: '#5d3e26',
  counter: '#8a5a33',
  counterTop: '#a06b3f',
  counterEdge: '#6e4525',
  pantry: '#7a5c2e',
  chop: '#9c6b30',
  wok: '#3d3d3d',
  wokGlow: '#e07830',
  plate: '#e8e0d0',
  sink: '#4a6b7a',
  serve: '#2e7d4f',
  trash: '#5a3a3a',
  ticket: '#fdf6e3',
  ticketText: '#2b2118',
  text: '#f5ead6',
  dim: '#c9b18c',
  danger: '#e04a3a',
  gold: '#f2b134',
  green: '#7bc96f',
  cook: '#f2c14e',
  apron: '#f5f0e6',
};

// Ingredients. prep is the chain of steps from raw to ready:
// 'chop' on the chopping board, 'wok' in the wok, 'none' needs no prep.
export const INGREDIENTS = {
  noodle: { name: 'Noodle', color: '#f2d492', prep: 'wok', chop: false, wok: true },
  rice: { name: 'Rice', color: '#f5f0e6', prep: 'wok', chop: false, wok: true },
  veg: { name: 'Veg', color: '#7bc96f', prep: 'chop', chop: true, wok: false },
  meat: { name: 'Meat', color: '#d97b6c', prep: 'chop+wok', chop: true, wok: true },
  egg: { name: 'Egg', color: '#f2e6a2', prep: 'chop', chop: true, wok: false },
  sauce: { name: 'Sauce', color: '#c96f2e', prep: 'none', chop: false, wok: false },
};

// A component is an ingredient plus its prep progress:
// state: 'raw' -> 'chopped' (after chop) -> 'ready' (after wok, or at once for
// chop-only / no-prep items). readyName is what the plate and tickets show.
export function componentLabel(ing, state) {
  const base = INGREDIENTS[ing].name;
  if (state === 'raw') return base;
  if (state === 'chopped') return 'Chopped ' + base;
  return base;
}

export const RECIPES = [
  {
    id: 'noodles',
    name: 'Lantern Noodles',
    color: '#f2b134',
    needs: [
      { ing: 'noodle', state: 'ready' },
      { ing: 'egg', state: 'ready' },
    ],
  },
  {
    id: 'ricebox',
    name: 'Golden Rice Box',
    color: '#f2d492',
    needs: [
      { ing: 'rice', state: 'ready' },
      { ing: 'veg', state: 'ready' },
      { ing: 'meat', state: 'ready' },
    ],
  },
  {
    id: 'skewer',
    name: 'Sizzling Skewer',
    color: '#e07830',
    needs: [
      { ing: 'meat', state: 'ready' },
      { ing: 'veg', state: 'ready' },
      { ing: 'sauce', state: 'ready' },
    ],
  },
];

// Stations: rectangles on the kitchen floor. x, y, w, h in canvas pixels.
// interactPoint is where the cook stands to use the station.
export const STATIONS = [
  { id: 'pantry', name: 'Pantry', x: 24, y: 132, w: 200, h: 96, color: '#7a5c2e', ix: 224, iy: 180 },
  { id: 'chop', name: 'Chop Board', x: 24, y: 252, w: 200, h: 96, color: '#9c6b30', ix: 224, iy: 300 },
  { id: 'wok', name: 'Wok', x: 24, y: 372, w: 200, h: 96, color: '#3d3d3d', ix: 224, iy: 420 },
  { id: 'sink', name: 'Sink', x: 24, y: 492, w: 200, h: 96, color: '#4a6b7a', ix: 224, iy: 540 },
  { id: 'plate', name: 'Plating', x: 1056, y: 132, w: 200, h: 96, color: '#8a5a33', ix: 1056, iy: 180 },
  { id: 'serve', name: 'Serve Window', x: 1056, y: 252, w: 200, h: 96, color: '#2e7d4f', ix: 1056, iy: 300 },
  { id: 'trash', name: 'Trash', x: 1056, y: 492, w: 200, h: 96, color: '#5a3a3a', ix: 1056, iy: 540 },
];

export function stationById(id) {
  return STATIONS.find((s) => s.id === id);
}
