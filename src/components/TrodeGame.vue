<!-- src/components/TrodeGame.vue -->
<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="game-container">
    <div class="gameplay-container">
      <canvas ref="mainCanvas" width="600" height="600" @click="handleClick"></canvas>
      <Minimap
        :map-size="mapSize"
        :tank="tank"
        :trodes="trodes"
        :spheres="spheres"
        :resource-hotspots="resourceHotspots"
        :nav-beacon="navBeacon"
      />
    </div>
    <div class="ui">
      <p>GCT Harvest: {{ gctScore.toFixed(1) }}</p>
      <p>Trodes Carried: {{ tank.trodesCarried }}/8 | Active: {{ trodes.length }}</p>
      <p>Nav Beacon: {{ navBeacon ? 'Active' : 'None' }}</p>
      <button @click="reset">Reset (R)</button>
      <div class="highscores">
        <h3>Top Hauls (GCT)</h3>
        <ul>
          <li v-for="(hs, idx) in highScores" :key="idx">{{ hs.playerName }}: {{ hs.score.toFixed(1) }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { saveScore, getHighScores } from '@/firebase';
import Minimap from './Minimap.vue';

/* ------------------------------------------------------------------
   Simple 2-D Perlin-style noise (value noise) – used only for contours
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

export default {
  name: 'TrodeGame',
  components: { Minimap },
  data() {
    return {
      mapSize: { w: 1200, h: 1200 },
      viewPort: { x: 0, y: 0, w: 600, h: 600 },
      tank: { x: 600, y: 600, angle: 0, speed: 200, trodesCarried: 8 },
      trodes: [],
      spheres: [],
      projectiles: [],
      resourceHotspots: [],
      navBeacon: null,
      flash: { color: null, timer: 0 },
      gctScore: 0,
      lastSavedScore: 0,
      highScores: [],
      lastTime: 0,
      manualInputThisFrame: false,
      animationFrameId: null,
      pressedKeys: new Set(),
      leftTreadOffset: 0,
      rightTreadOffset: 0,
      currentForwardSpeed: 0,
      currentRotationSpeed: 0,
      lastPosition: { x: 600, y: 600 },
      stuckTimer: 0,
      // noise tables for each hotspot (created once in generateHotspots)
      hotspotNoise: []
    };
  },
  async mounted() {
    await this.loadHighScores();
    this.reset();
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
  },
  methods: {
    normalizeAngle(diff) {
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return diff;
    },
    async reset() {
      this.tank = { x: 600, y: 600, angle: 0, speed: 200, trodesCarried: 8 };
      this.trodes = []; this.spheres = []; this.projectiles = [];
      this.navBeacon = null; this.gctScore = 0; this.lastSavedScore = 0;
      this.currentForwardSpeed = this.currentRotationSpeed = 0;
      this.leftTreadOffset = this.rightTreadOffset = 0;
      this.lastPosition = { x: 600, y: 600 }; this.stuckTimer = 0;
      this.generateHotspots();
      this.updateViewPort(); this.draw();
      await this.loadHighScores();
    },
    generateHotspots() {
      this.resourceHotspots = [];
      this.hotspotNoise = [];
      for (let i = 0; i < 4; i++) {
        const res = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
        const seed = Math.random();
        this.hotspotNoise.push(createNoise(seed));
        this.resourceHotspots.push({
          x: Math.random() * this.mapSize.w,
          y: Math.random() * this.mapSize.h,
          radius: 200,
          resource: res,
          seed,
          // Precompute contour paths once - FIXED SHAPE, NO VIBRATION
          contours: this.precomputeContours(seed)
        });
      }
    },
    /* --------------------------------------------------------------
       Precompute static contour paths ONCE per hotspot at generation
       These paths NEVER change - rock solid, no vibration
       -------------------------------------------------------------- */
    precomputeContours(seed) {
      const perm = createNoise(seed);
      const baseR = 200;
      const steps = 120;  // high resolution for smooth curves
      const bands = 5;    // fixed 5 bands
      const bandStep = baseR / (bands + 1);
      const contours = [];

      for (let b = bands; b > 0; b--) {
        const bandR = b * bandStep;
        const path = [];
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          const nx = Math.cos(a) * bandR;
          const ny = Math.sin(a) * bandR;
          // FIXED noise sampling using absolute world-space coords
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
    },
    /* --------------------------------------------------------------
       Draw STATIC precomputed contours - NO RECOMPUTATION
       -------------------------------------------------------------- */
    drawHotspot(ctx, h, vx, vy) {
      const cx = h.x - vx;
      const cy = h.y - vy;
      
      // Draw each precomputed static contour
      h.contours.forEach(({ band, path }) => {
        const opacity = 0.60 * (band / 5);  // 60% max at center → 5% at edge (linear)
        ctx.globalAlpha = opacity;
        ctx.fillStyle = h.resource.color;
        ctx.beginPath();
        
        path.forEach((p, i) => {
          const px = cx + p.x;
          const py = cy + p.y;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fill();
      });
      
      ctx.globalAlpha = 1.0;

      // Centre dot
      ctx.fillStyle = h.resource.color;
      ctx.beginPath();
      ctx.arc(cx, cy, 25, 0, Math.PI * 2);
      ctx.fill();
    },

    handleKeyDown(e) {
      const k = e.key.toLowerCase();
      if (k === 'r') { this.reset(); return; }
      if (k === 'control' && this.tank.trodesCarried > 0) { this.placeTrode(); return; }
      if (k === ' ') { this.fireProjectile(); return; }
      this.pressedKeys.add(k);
    },
    handleKeyUp(e) { this.pressedKeys.delete(e.key.toLowerCase()); },
    handleClick(e) {
      const r = this.$refs.mainCanvas.getBoundingClientRect();
      const mx = e.clientX - r.left + this.viewPort.x;
      const my = e.clientY - r.top + this.viewPort.y;
      this.navBeacon = {
        x: Math.max(0, Math.min(this.mapSize.w, mx)),
        y: Math.max(0, Math.min(this.mapSize.h, my))
      };
      this.flash.color = [255, 255, 0]; this.flash.timer = 10;
      this.updateViewPort(); this.draw();
    },
    clampTankPosition() {
      this.tank.x = Math.max(0, Math.min(this.mapSize.w, this.tank.x));
      this.tank.y = Math.max(0, Math.min(this.mapSize.h, this.tank.y));
    },
    updateViewPort() {
      this.viewPort.x = this.tank.x - this.viewPort.w / 2;
      this.viewPort.y = this.tank.y - this.viewPort.h / 2;
      this.viewPort.x = Math.max(0, Math.min(this.mapSize.w - this.viewPort.w, this.viewPort.x));
      this.viewPort.y = Math.max(0, Math.min(this.mapSize.h - this.viewPort.h, this.viewPort.y));
    },
    placeTrode() {
      if (this.tank.trodesCarried <= 0) return;
      const hotspot = this.findNearestHotspot(this.tank.x, this.tank.y);
      this.trodes.push({
        x: this.tank.x, y: this.tank.y,
        energy: 15.0, mined: 0,
        resource: hotspot ? hotspot.resource : null,
        miningArea: { x: this.tank.x - 50, y: this.tank.y - 50, w: 100, h: 100 }
      });
      this.tank.trodesCarried--;
      this.flash.color = [0, 255, 255]; this.flash.timer = 10;
      this.draw();
    },
    findNearestHotspot(tx, ty) {
      let nearest = null, minDist = Infinity;
      for (const h of this.resourceHotspots) {
        const d = Math.hypot(tx - h.x, ty - h.y);
        if (d < h.radius && d < minDist) { minDist = d; nearest = h; }
      }
      return nearest;
    },
    fireProjectile() {
      const bl = 35;
      this.projectiles.push({
        x: this.tank.x + bl * Math.cos(this.tank.angle),
        y: this.tank.y + bl * Math.sin(this.tank.angle),
        angle: this.tank.angle, speed: 400, lifetime: 2
      });
    },
    checkCollection() {
      let harvested = false;
      this.spheres = this.spheres.filter(s => {
        if (Math.hypot(this.tank.x - s.x, this.tank.y - s.y) < 20) {
          this.gctScore += s.resource.value; harvested = true; return false;
        }
        return true;
      });
      if (harvested && this.gctScore - this.lastSavedScore >= 5) {
        saveScore(this.gctScore); this.lastSavedScore = this.gctScore;
      }
    },
    async loadHighScores() {
      try { this.highScores = await getHighScores(); }
      catch (e) { console.error(e); this.highScores = []; }
    },

    /* -------------------------- GAME LOOP -------------------------- */
    gameLoop(now) {
      if (!this.lastTime) this.lastTime = now;
      const dt = now - this.lastTime, ds = dt / 1000;
      this.lastTime = now;

      /* ---- INPUT ---- */
      let fwd = 0, rot = 0;
      if (this.pressedKeys.has('w') || this.pressedKeys.has('arrowup')) fwd += 1;
      if (this.pressedKeys.has('s') || this.pressedKeys.has('arrowdown')) fwd -= 1;
      if (this.pressedKeys.has('a') || this.pressedKeys.has('arrowleft')) rot -= 1;
      if (this.pressedKeys.has('d') || this.pressedKeys.has('arrowright')) rot += 1;
      this.manualInputThisFrame = fwd || rot;
      if (this.manualInputThisFrame && this.navBeacon) this.navBeacon = null;

      /* ---- TARGET SPEEDS ---- */
      let targetF = 0, targetR = 0;
      if (this.manualInputThisFrame) {
        targetF = fwd * this.tank.speed;
        targetR = rot * 2;
      } else if (this.navBeacon) {
        const dx = this.navBeacon.x - this.tank.x;
        const dy = this.navBeacon.y - this.tank.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 5) this.navBeacon = null;
        else {
          const a = Math.atan2(dy, dx);
          let diff = this.normalizeAngle(a - this.tank.angle);
          if (Math.abs(diff) < 0.05) diff = 0;
          const stop = this.tank.speed * 0.1;
          const close = stop * 2;
          if (dist < close) targetR = 0;
          else {
            const turn = 2;
            const adj = Math.sign(diff) * Math.min(Math.abs(diff), turn * ds);
            targetR = adj / ds;
          }
          const ff = Math.cos(diff);
          targetF = this.tank.speed * Math.max(0, ff) * Math.min(1, dist / stop);
        }
      }

      /* ---- ACCELERATION ---- */
      const ease = 0.1;
      const fAcc = this.tank.speed / ease, rAcc = 2 / ease;
      const fΔ = fAcc * ds, rΔ = rAcc * ds;
      this.currentForwardSpeed = this.currentForwardSpeed < targetF
        ? Math.min(this.currentForwardSpeed + fΔ, targetF)
        : Math.max(this.currentForwardSpeed - fΔ, targetF);
      this.currentRotationSpeed = this.currentRotationSpeed < targetR
        ? Math.min(this.currentRotationSpeed + rΔ, targetR)
        : Math.max(this.currentRotationSpeed - rΔ, targetR);

      /* ---- MOVE TANK ---- */
      this.tank.angle += this.currentRotationSpeed * ds;
      this.tank.x += this.currentForwardSpeed * Math.cos(this.tank.angle) * ds;
      this.tank.y += this.currentForwardSpeed * Math.sin(this.tank.angle) * ds;
      this.clampTankPosition();

      /* ---- STUCK CHECK ---- */
      if (this.navBeacon) {
        const dB = Math.hypot(this.navBeacon.x - this.tank.x, this.navBeacon.y - this.tank.y);
        const moved = Math.hypot(this.tank.x - this.lastPosition.x, this.tank.y - this.lastPosition.y);
        if (dB < 50 && moved < 1) {
          this.stuckTimer += ds;
          if (this.stuckTimer > 0.5) {
            this.navBeacon = null; this.currentForwardSpeed = this.currentRotationSpeed = 0;
            this.stuckTimer = 0;
          }
        } else this.stuckTimer = 0;
      }
      this.lastPosition = { x: this.tank.x, y: this.tank.y };

      /* ---- TREAD ANIMATION ---- */
      const halfW = 23, rate = 20;
      const lSp = this.currentForwardSpeed - this.currentRotationSpeed * halfW;
      const rSp = this.currentForwardSpeed + this.currentRotationSpeed * halfW;
      if (Math.abs(lSp) > 0.01) {
        this.leftTreadOffset += (lSp / this.tank.speed) * -rate * ds;
        this.leftTreadOffset = (this.leftTreadOffset % 5 + 5) % 5;
      }
      if (Math.abs(rSp) > 0.01) {
        this.rightTreadOffset += (rSp / this.tank.speed) * -rate * ds;
        this.rightTreadOffset = (this.rightTreadOffset % 5 + 5) % 5;
      }

      /* ---- PROJECTILES ---- */
      this.projectiles = this.projectiles.filter(p => {
        p.x += p.speed * Math.cos(p.angle) * ds;
        p.y += p.speed * Math.sin(p.angle) * ds;
        p.lifetime -= ds;
        for (const t of this.trodes) {
          if (Math.hypot(p.x - t.x, p.y - t.y) < 20) {
            t.energy += 5; this.flash.color = [0,255,0]; this.flash.timer = 5;
            return false;
          }
        }
        return p.lifetime > 0 && p.x >= 0 && p.x <= this.mapSize.w && p.y >= 0 && p.y <= this.mapSize.h;
      });

      /* ---- TRODE MINING ---- */
      const depleteRate = 40 / 60;
      for (let i = this.trodes.length - 1; i >= 0; i--) {
        const t = this.trodes[i];
        if (t.energy > 0) {
          const dep = depleteRate * ds;
          t.energy = Math.max(0, t.energy - dep);
          t.mined += dep;
          while (t.mined >= 15 && t.resource) {
            this.spheres.push({
              x: t.miningArea.x + Math.random() * t.miningArea.w,
              y: t.miningArea.y + Math.random() * t.miningArea.h,
              resource: t.resource
            });
            t.mined -= 15;
          }
          if (t.energy <= 0) this.trodes.splice(i, 1);
        }
      }

      this.updateViewPort(); this.checkCollection(); this.draw();
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
    },

    draw() {
      if (!this.$refs.mainCanvas) return;
      const ctx = this.$refs.mainCanvas.getContext('2d');
      ctx.clearRect(0, 0, 600, 600);

      /* flash overlay */
      if (this.flash.timer > 0) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = `rgb(${this.flash.color.join(',')})`;
        ctx.fillRect(0, 0, 600, 600);
        ctx.globalAlpha = 1.0;
        this.flash.timer--;
      }

      ctx.fillStyle = '#CC6600';
      ctx.fillRect(0, 0, 600, 600);

      /* ----- STATIC ORGANIC HOTSPOTS ----- */
      this.resourceHotspots.forEach(h => {
        const hx = h.x - this.viewPort.x;
        const hy = h.y - this.viewPort.y;
        if (hx > -250 && hx < 850 && hy > -250 && hy < 850) {
          this.drawHotspot(ctx, h, this.viewPort.x, this.viewPort.y);
        }
      });

      /* trodes */
      this.trodes.forEach(t => {
        const tx = t.x - this.viewPort.x, ty = t.y - this.viewPort.y;
        if (tx > -50 && tx < 650 && ty > -50 && ty < 650) {
          ctx.beginPath();
          ctx.moveTo(tx + 20, ty);
          for (let i = 1; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.lineTo(tx + 20 * Math.cos(a), ty + 20 * Math.sin(a));
          }
          ctx.closePath();
          ctx.fillStyle = '#888888'; ctx.fill();
          ctx.strokeStyle = '#444444'; ctx.lineWidth = 2; ctx.stroke();

          const a = t.energy / 15;
          ctx.fillStyle = `rgba(0,255,0,${a})`;
          ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill();

          const mx = t.miningArea.x - this.viewPort.x;
          const my = t.miningArea.y - this.viewPort.y;
          ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 1;
          ctx.setLineDash([5,5]); ctx.strokeRect(mx, my, t.miningArea.w, t.miningArea.h);
          ctx.setLineDash([]);
        }
      });

      /* spheres */
      this.spheres.forEach(s => {
        const sx = s.x - this.viewPort.x, sy = s.y - this.viewPort.y;
        if (sx > -15 && sx < 615 && sy > -15 && sy < 615) {
          ctx.fillStyle = s.resource.color;
          ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
        }
      });

      /* projectiles */
      this.projectiles.forEach(p => {
        const px = p.x - this.viewPort.x, py = p.y - this.viewPort.y;
        if (px > -10 && px < 610 && py > -10 && py < 610) {
          ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(px, py);
          const trail = 10;
          ctx.lineTo(px - trail * Math.cos(p.angle), py - trail * Math.sin(p.angle));
          ctx.stroke();
          ctx.globalAlpha = 0.5; ctx.lineWidth = 5; ctx.stroke(); ctx.globalAlpha = 1;
        }
      });

      /* tank */
      const tx = this.tank.x - this.viewPort.x, ty = this.tank.y - this.viewPort.y;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(this.tank.angle);
      ctx.fillStyle = '#333333'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 2;
      const treadL = 60, thick = 10, step = 5, phase = step / 2;
      const lShift = (this.leftTreadOffset + phase) % step;
      const rShift = this.rightTreadOffset % step;

      ctx.fillRect(-30, -23, treadL, thick);
      for (let x = -30 - step + lShift; x < 30 + step; x += step) {
        ctx.beginPath(); ctx.moveTo(x, -23); ctx.lineTo(x, -13); ctx.stroke();
      }
      ctx.fillRect(-30, 13, treadL, thick);
      for (let x = -30 - step + rShift; x < 30 + step; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 13); ctx.lineTo(x, 23); ctx.stroke();
      }

      ctx.fillStyle = '#A0522D';
      ctx.fillRect(-30, -15, 60, 30);
      ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 3; ctx.strokeRect(-30, -15, 60, 30);
      ctx.fillStyle = '#696969';
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#333333';
      ctx.fillRect(15, -3, 20, 6);
      ctx.restore();
    }
  }
};
</script>

<style scoped>
.game-container { text-align:center; }
.gameplay-container { position:relative; display:inline-block; }
canvas { border:2px solid #8B4513; background:#CC6600; cursor:crosshair; }
.minimap-container { position:absolute; top:10px; left:50%; transform:translateX(-50%); }
.ui { margin-top:10px; color:#FFCC00; font-family:monospace; }
button { background:#8B4513; color:#FFCC00; border:1px solid #CC6600; padding:8px 16px; margin:5px; cursor:pointer; }
.highscores { margin-top:20px; color:#00FFFF; text-align:left; max-height:200px; overflow-y:auto; }
</style>