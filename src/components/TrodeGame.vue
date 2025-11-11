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
      <p>Trodes Carried: {{ tank.trodesCarried }}/3 | Active: {{ trodes.length }}</p>
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
      tank: { x: 600, y: 600, angle: 0, speed: 200, trodesCarried: 3 },
      trodes: [],
      spheres: [],
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
      treadOffset: 0
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
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  },
  methods: {
    normalizeAngle(diff) {
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return diff;
    },
    async reset() {
      this.tank = { x: 600, y: 600, angle: 0, speed: 200, trodesCarried: 3 };
      this.trodes = [];
      this.spheres = [];
      this.navBeacon = null;
      this.gctScore = 0;
      this.lastSavedScore = 0;
      this.generateHotspots();
      this.updateViewPort();
      this.draw();
      await this.loadHighScores();
    },
    generateHotspots() {
      this.resourceHotspots = [];
      for (let i = 0; i < 4; i++) {
        const res = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
        this.resourceHotspots.push({
          x: Math.random() * this.mapSize.w,
          y: Math.random() * this.mapSize.h,
          radius: 200,
          resource: res
        });
      }
    },
    handleKeyDown(e) {
      const key = e.key.toLowerCase();
      if (key === 'r') {
        this.reset();
        return;
      }
      if (key === 'control' && this.tank.trodesCarried > 0) {
        this.placeTrode();
        return;
      }
      this.pressedKeys.add(key);
    },
    handleKeyUp(e) {
      this.pressedKeys.delete(e.key.toLowerCase());
    },
    handleClick(e) {
      const rect = this.$refs.mainCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldX = mouseX + this.viewPort.x;
      const worldY = mouseY + this.viewPort.y;
      this.navBeacon = {
        x: Math.max(0, Math.min(this.mapSize.w, worldX)),
        y: Math.max(0, Math.min(this.mapSize.h, worldY))
      };
      this.flash.color = [255, 255, 0];
      this.flash.timer = 10;
      this.updateViewPort();
      this.draw();
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
      if (this.tank.trodesCarried > 0) {
        const hotspot = this.findNearestHotspot(this.tank.x, this.tank.y);
        this.trodes.push({
          x: this.tank.x,
          y: this.tank.y,
          energy: 15.0,
          resource: hotspot ? hotspot.resource : null,
          miningArea: { x: this.tank.x - 50, y: this.tank.y - 50, w: 100, h: 100 }
        });
        this.tank.trodesCarried--;
        this.flash.color = [0, 255, 255];
        this.flash.timer = 10;
        this.draw();
      }
    },
    findNearestHotspot(tx, ty) {
      let nearest = null;
      let minDist = Infinity;
      for (const h of this.resourceHotspots) {
        const dist = Math.hypot(tx - h.x, ty - h.y);
        if (dist < h.radius && dist < minDist) {
          minDist = dist;
          nearest = h;
        }
      }
      return nearest;
    },
    checkCollection() {
      let harvested = false;
      this.spheres = this.spheres.filter(sphere => {
        if (Math.hypot(this.tank.x - sphere.x, this.tank.y - sphere.y) < 20) {
          this.gctScore += sphere.resource.value;
          harvested = true;
          return false;
        }
        return true;
      });
      if (harvested && this.gctScore - this.lastSavedScore >= 5) {
        saveScore(this.gctScore);
        this.lastSavedScore = this.gctScore;
      }
    },
    async loadHighScores() {
      try {
        this.highScores = await getHighScores();
      } catch (e) {
        console.error('Failed to load high scores:', e);
        this.highScores = [];
      }
    },
    gameLoop(now) {
      if (this.lastTime === 0) {
        this.lastTime = now;
      }
      const delta = now - this.lastTime;
      const deltaSeconds = delta / 1000;
      this.lastTime = now;

      // Handle key inputs for movement and rotation
      let forward = 0;
      if (this.pressedKeys.has('w') || this.pressedKeys.has('arrowup')) forward += 1;
      if (this.pressedKeys.has('s') || this.pressedKeys.has('arrowdown')) forward -= 1;
      let rotation = 0;
      if (this.pressedKeys.has('a') || this.pressedKeys.has('arrowleft')) rotation -= 1;
      if (this.pressedKeys.has('d') || this.pressedKeys.has('arrowright')) rotation += 1;

      this.manualInputThisFrame = forward !== 0 || rotation !== 0;

      if (this.manualInputThisFrame && this.navBeacon) {
        this.navBeacon = null;
      }

      // Apply manual movement
      this.tank.angle += rotation * 2 * deltaSeconds; // 2 rad/s rotation speed
      const dx_manual = forward * Math.cos(this.tank.angle) * this.tank.speed * deltaSeconds;
      const dy_manual = forward * Math.sin(this.tank.angle) * this.tank.speed * deltaSeconds;
      this.tank.x += dx_manual;
      this.tank.y += dy_manual;
      this.clampTankPosition();

      // Animate treads if moving manually
      const manualSpeed = Math.hypot(dx_manual, dy_manual) / deltaSeconds;
      if (manualSpeed > 0) {
        this.treadOffset += forward * -20 * deltaSeconds; // Adjusted sign for correct direction
        this.treadOffset = (this.treadOffset % 5 + 5) % 5; // Wrap around 5
      }

      // Deplete trode energy
      const depleteRate = 5 / 60;
      for (let i = this.trodes.length - 1; i >= 0; i--) {
        const trode = this.trodes[i];
        if (trode.energy > 0) {
          const deplete = depleteRate * deltaSeconds;
          trode.energy = Math.max(0, trode.energy - deplete);
          if (trode.energy <= 0 && trode.resource) {
            this.spheres.push({
              x: trode.miningArea.x + Math.random() * trode.miningArea.w,
              y: trode.miningArea.y + Math.random() * trode.miningArea.h,
              resource: trode.resource
            });
            this.trodes.splice(i, 1);
          }
        }
      }

      // Autopilot to navBeacon if no manual input
      if (this.navBeacon && !this.manualInputThisFrame) {
        const dx = this.navBeacon.x - this.tank.x;
        const dy = this.navBeacon.y - this.tank.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 20) {
          this.navBeacon = null;
        } else {
          const targetAngle = Math.atan2(dy, dx);
          let diff = this.normalizeAngle(targetAngle - this.tank.angle);
          const turnSpeed = 2; // rad/s
          const angleAdjustment = Math.sign(diff) * Math.min(Math.abs(diff), turnSpeed * deltaSeconds);
          this.tank.angle += angleAdjustment;

          // Calculate forward movement, reduced if turning sharply
          const forwardFactor = Math.cos(diff); // 1 if aligned, less if turning
          const autoDx = Math.cos(this.tank.angle) * this.tank.speed * deltaSeconds * Math.max(0, forwardFactor);
          const autoDy = Math.sin(this.tank.angle) * this.tank.speed * deltaSeconds * Math.max(0, forwardFactor);
          this.tank.x += autoDx;
          this.tank.y += autoDy;
          this.clampTankPosition();

          const autoSpeed = Math.hypot(autoDx, autoDy) / deltaSeconds;
          if (autoSpeed > 0) {
            this.treadOffset -= 20 * deltaSeconds; // Animate treads in autopilot (forward direction)
            this.treadOffset = (this.treadOffset % 5 + 5) % 5;
          }
        }
      }

      this.updateViewPort();
      this.checkCollection();
      this.draw();
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
    },
    draw() {
      if (!this.$refs.mainCanvas) return;
      const ctx = this.$refs.mainCanvas.getContext('2d');
      ctx.clearRect(0, 0, 600, 600);

      if (this.flash.timer > 0) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = `rgb(${this.flash.color.join(',')})`;
        ctx.fillRect(0, 0, 600, 600);
        ctx.globalAlpha = 1.0;
        this.flash.timer--;
      }

      ctx.fillStyle = '#CC6600';
      ctx.fillRect(0, 0, 600, 600);

      this.resourceHotspots.forEach(h => {
        const hx = h.x - this.viewPort.x;
        const hy = h.y - this.viewPort.y;
        if (hx > -200 && hx < 800 && hy > -200 && hy < 800) {
          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.strokeStyle = h.resource.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(hx, hy, h.radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          ctx.fillStyle = h.resource.color;
          ctx.beginPath();
          ctx.arc(hx, hy, 25, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      this.trodes.forEach(t => {
        const tx = t.x - this.viewPort.x;
        const ty = t.y - this.viewPort.y;
        if (tx > -50 && tx < 650 && ty > -50 && ty < 650) {
          ctx.beginPath();
          ctx.moveTo(tx + 20 * Math.cos(0), ty + 20 * Math.sin(0));
          for (let i = 1; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            ctx.lineTo(tx + 20 * Math.cos(ang), ty + 20 * Math.sin(ang));
          }
          ctx.closePath();
          ctx.fillStyle = '#888888';
          ctx.fill();
          ctx.strokeStyle = '#444444';
          ctx.lineWidth = 2;
          ctx.stroke();

          const alpha = t.energy / 15;
          ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
          ctx.beginPath();
          ctx.arc(tx, ty, 12, 0, Math.PI * 2);
          ctx.fill();

          const mx = t.miningArea.x - this.viewPort.x;
          const my = t.miningArea.y - this.viewPort.y;
          ctx.strokeStyle = '#00FFFF';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(mx, my, t.miningArea.w, t.miningArea.h);
          ctx.setLineDash([]);
        }
      });

      this.spheres.forEach(s => {
        const sx = s.x - this.viewPort.x;
        const sy = s.y - this.viewPort.y;
        if (sx > -15 && sx < 615 && sy > -15 && sy < 615) {
          ctx.fillStyle = s.resource.color;
          ctx.beginPath();
          ctx.arc(sx, sy, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      const tankX = this.tank.x - this.viewPort.x;
      const tankY = this.tank.y - this.viewPort.y;
      ctx.save();
      ctx.translate(tankX, tankY);
      ctx.rotate(this.tank.angle);
      // Treads - left and right sides with distinguishable segments
      ctx.fillStyle = '#333333';
      ctx.strokeStyle = '#000000'; // Black lines for better visibility
      ctx.lineWidth = 2; // Thicker lines

      const treadLength = 60;
      const treadThickness = 10;
      const step = 5;
      let offset = this.treadOffset;

      // Left tread (negative y)
      ctx.fillRect(-30, -23, treadLength, treadThickness);
      for (let x = -30 - step + (offset % step); x < 30 + step; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, -23);
        ctx.lineTo(x, -13);
        ctx.stroke();
      }

      // Right tread (positive y)
      ctx.fillRect(-30, 13, treadLength, treadThickness);
      for (let x = -30 - step + (offset % step); x < 30 + step; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 13);
        ctx.lineTo(x, 23);
        ctx.stroke();
      }

      // Body
      ctx.fillStyle = '#A0522D';
      ctx.fillRect(-30, -15, 60, 30);
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 3;
      ctx.strokeRect(-30, -15, 60, 30);

      // Turret
      ctx.fillStyle = '#696969';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();

      // Barrel
      ctx.fillStyle = '#333333';
      ctx.fillRect(15, -3, 20, 6);

      ctx.restore();
    }
  }
};
</script>

<style scoped>
.game-container { text-align: center; }
.gameplay-container {
  position: relative;
  display: inline-block;
}
canvas { 
  border: 2px solid #8B4513; 
  background: #CC6600; 
  cursor: crosshair;
}
.minimap-container {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
}
.ui { 
  margin-top: 10px; 
  color: #FFCC00; 
  font-family: monospace;
}
button { 
  background: #8B4513; 
  color: #FFCC00; 
  border: 1px solid #CC6600; 
  padding: 8px 16px; 
  margin: 5px;
  cursor: pointer;
}
.highscores { 
  margin-top: 20px; 
  color: #00FFFF; 
  text-align: left;
  max-height: 200px;
  overflow-y: auto;
}
</style>