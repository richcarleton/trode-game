// src/composables/useHotspotGenerator.js
// NOTE: `ref` and `mapSize` are **intentionally unused** – kept for future expansion.
// ESLint rule is disabled only for this line.
import { ref } from 'vue'; // eslint-disable-line no-unused-vars

const RESOURCES = [
  { name: 'Aurorium', symbol: 'AuR', value: 5.2, color: '#00FFAA' },
  { name: 'Celestium', symbol: 'CeL', value: 8.7, color: '#AABBFF' },
  { name: 'Draconium', symbol: 'DrC', value: 12.1, color: '#FF5500' },
  { name: 'Empyrium', symbol: 'EmP', value: 3.9, color: '#FFFFFF' },
  { name: 'Fluxium', symbol: 'FlX', value: 6.4, color: '#00AAFF' },
  { name: 'Galaxium', symbol: 'GaX', value: 15.3, color: '#1122AA' },
  { name: 'Harmonium', symbol: 'HaM', value: 4.8, color: '#FFCC00' },
  { name: 'Ignitium', symbol: 'IgN', value: 9.2, color: '#FF0000' },
  { name: 'Jovium', symbol: 'JoV', value: 7.6, color: '#0000FF' },
  { name: 'Krypium', symbol: 'KrY', value: 11.0, color: '#AAAAAA' }
];

/* ------------------------------------------------------------------
   Simple 2-D Perlin-style value noise – used only for contours
   ------------------------------------------------------------------ */
function createNoise(seed = Math.random()) {
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor((seed + i) * 997) % (i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  return perm;
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

function grad(hash, x, y) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
}

function noise2D(perm, x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const a = perm[X] + Y, b = perm[X + 1] + Y;
  return (grad(perm[a], x, y) * (1 - u) * (1 - v) +
          grad(perm[b], x - 1, y) * u * (1 - v) +
          grad(perm[a + 1], x, y - 1) * (1 - u) * v +
          grad(perm[b + 1], x - 1, y - 1) * u * v);
}

/* ------------------------------------------------------------------ */
export function useHotspotGenerator({ resourceHotspots /*, mapSize */ }) {
  // `mapSize` is kept for future use – ignore ESLint warning
  // eslint-disable-next-line no-unused-vars

  const precomputeContours = seed => {
    const perm = createNoise(seed);
    const baseR = 200;
    const steps = 60;  // ↓ REDUCED FROM 120 → 60 (50% fewer points)
    const bands = 5;
    const bandStep = baseR / (bands + 1);
    const contours = [];

    for (let b = bands; b > 0; b--) {
      const bandR = b * bandStep;
      const path = [];
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const nx = Math.cos(a) * bandR;
        const ny = Math.sin(a) * bandR;
        const noiseScale = 0.004;
        const n1 = noise2D(perm, nx * noiseScale + 10000, ny * noiseScale + 10000);
        const n2 = noise2D(perm, nx * noiseScale * 2.3 + 20000, ny * noiseScale * 2.3 + 20000) * 0.5;
        const perturb = (n1 + n2) * 30 * (b / bands);
        const r = bandR + perturb;
        path.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      contours.push({ band: b, path });
    }
    return contours;
  };

  const generateHotspots = () => {
    resourceHotspots.value = [];
    for (let i = 0; i < 4; i++) {
      const res = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
      const seed = Math.random();
      resourceHotspots.value.push({
        x: 300 + Math.random() * 600,   // clustered near start (600,600)
        y: 300 + Math.random() * 600,
        radius: 200,
        resource: res,
        seed,
        contours: precomputeContours(seed)
      });
    }
  };

  const drawHotspot = (ctx, h, vx, vy) => {
    const cx = h.x - vx;
    const cy = h.y - vy;

    // Contours – PERFORMANCE OPTIMIZED
    h.contours.forEach(({ band, path }) => {
      const opacity = 0.8 * (band / 5);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = h.resource.color;
      ctx.beginPath();
      
      // FASTER PATH DRAWING – fewer operations
      const first = path[0];
      ctx.moveTo(cx + first.x, cy + first.y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(cx + path[i].x, cy + path[i].y);
      }
      ctx.closePath();
      ctx.fill();
    });

    ctx.globalAlpha = 1.0;

    // Center dot
    ctx.fillStyle = h.resource.color;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();

    // Symbol label
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(h.resource.symbol, cx, cy + 45);
  };

  return { generateHotspots, drawHotspot };
}