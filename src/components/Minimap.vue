<!-- src/components/Minimap.vue -->
<template>
  <div class="minimap-container">
    <canvas ref="minimapCanvas" width="150" height="150" class="minimap-canvas"></canvas>
  </div>
</template>

<script>
/* eslint-disable vue/multi-word-component-names */

export default {
  name: 'Minimap',
  props: {
    mapSize: { type: Object, required: true },
    tank: { type: Object, required: true },
    trodes: { type: Array, default: () => [] },
    spheres: { type: Array, default: () => [] },
    resourceHotspots: { type: Array, default: () => [] },
    navBeacon: { type: Object, default: null }
  },
  mounted() {
    this.drawMinimap();
    this.$watch(() => [this.tank, this.trodes, this.spheres, this.resourceHotspots, this.navBeacon], () => {
      this.drawMinimap();
    }, { deep: true });
  },
  methods: {
    drawMinimap() {
      const canvas = this.$refs.minimapCanvas;
      const ctx = canvas.getContext('2d');
      const scaleX = canvas.width / this.mapSize.w;
      const scaleY = canvas.height / this.mapSize.h;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#331A00';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      ctx.globalAlpha = 0.65;

      this.resourceHotspots.forEach(h => {
        const mx = h.x * scaleX;
        const my = h.y * scaleY;
        ctx.fillStyle = h.resource.color;
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      this.trodes.forEach(t => {
        const mx = t.x * scaleX;
        const my = t.y * scaleY;
        ctx.save();
        ctx.translate(mx, my);
        ctx.fillStyle = '#888888';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const x = 2 * Math.cos(ang);
          const y = 2 * Math.sin(ang);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();

        const alpha = t.energy / 15;
        ctx.fillStyle = `rgba(0, 255, 0, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(mx, my, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });

      this.spheres.forEach(s => {
        const mx = s.x * scaleX;
        const my = s.y * scaleY;
        ctx.fillStyle = s.resource.color;
        ctx.beginPath();
        ctx.arc(mx, my, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      if (this.navBeacon) {
        const mx = this.navBeacon.x * scaleX;
        const my = this.navBeacon.y * scaleY;
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.moveTo(mx, my - 3);
        ctx.lineTo(mx - 3, my + 3);
        ctx.lineTo(mx + 3, my + 3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      const px = this.tank.x * scaleX;
      const py = this.tank.y * scaleY;
      ctx.fillStyle = '#0000FF';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.globalAlpha = 1.0;
    }
  }
};
</script>

<style scoped>
.minimap-container[data-v-a00135b6] {
    position: absolute;
    top: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: inline-block;
}
.minimap-canvas {
  background: rgba(0,0,0,0.3);
  border: 1px solid #8B4513;
  box-shadow: 0 0 10px rgba(255,255,255,0.3);
  display: block;
}
</style>