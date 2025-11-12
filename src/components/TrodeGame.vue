<!-- src/components/TrodeGame.vue -->
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
      <p>Hotspots: {{ resourceHotspots.length }}</p>
      <button @click="reset">Reset (R)</button>

      <div class="highscores">
        <h3>Top Hauls (GCT)</h3>
        <ul>
          <li v-for="(hs, idx) in highScores" :key="idx">
            {{ hs.playerName }}: {{ hs.score.toFixed(1) }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import Minimap from './Minimap.vue';
import { useGameState } from '@/composables/useGameState';
import { useGameInput } from '@/composables/useGameInput';
import { useGameLoop } from '@/composables/useGameLoop';
import { useHotspotGenerator } from '@/composables/useHotspotGenerator';
import { getHighScores } from '@/firebase';

export default {
  name: 'TrodeGame',
  components: { Minimap },
  setup() {
    const mainCanvas = ref(null);
    const gctScore = ref(0);
    const highScores = ref([]);

    // ------------------------------------------------------------------
    // 1. Game State
    // ------------------------------------------------------------------
    const {
      mapSize, viewPort, tank, trodes, spheres, projectiles,
      resourceHotspots, navBeacon, flash,
      // eslint-disable-next-line no-unused-vars
      lastTime, pressedKeys, leftTreadOffset, rightTreadOffset,
      currentForwardSpeed, currentRotationSpeed, lastPosition, stuckTimer,
      reset, updateViewPort, clampTank,
      TANK_SPEED, ROT_SPEED, PROJECTILE_SPEED, DEPLETION_RATE
    } = useGameState({ gctScore });

    // ------------------------------------------------------------------
    // 2. Game Input
    // ------------------------------------------------------------------
    const {
      handleKeyDown, handleKeyUp, handleClick,
      placeTrode, fireProjectile, checkCollection,
      normalizeAngle
    } = useGameInput({
      tank, trodes, projectiles, navBeacon, resourceHotspots,
      gctScore, pressedKeys, updateViewPort,
      mainCanvas, mapSize, viewPort, reset, spheres
    });

    // ------------------------------------------------------------------
    // 3. Game Loop
    // ------------------------------------------------------------------
    const { renderGameObjects } = useGameLoop({
      mainCanvas,
      mapSize,
      viewPort,
      tank, trodes, spheres, projectiles,
      flash, pressedKeys, leftTreadOffset, rightTreadOffset,
      currentForwardSpeed, currentRotationSpeed, lastPosition, stuckTimer,
      navBeacon,
      TANK_SPEED, ROT_SPEED, PROJECTILE_SPEED, DEPLETION_RATE,
      clampTank, updateViewPort, checkCollection, normalizeAngle
    });

    // ------------------------------------------------------------------
    // 4. Hotspot generator
    // ------------------------------------------------------------------
    const { generateHotspots, drawHotspot } = useHotspotGenerator({
      resourceHotspots,
      mapSize
    });

    // ------------------------------------------------------------------
    // 5. FULL DRAW
    // ------------------------------------------------------------------
    const draw = () => {
      if (!mainCanvas.value) return;

      const ctx = mainCanvas.value.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 600, 600);

      // 1. Background
      ctx.fillStyle = '#CC6600';
      ctx.fillRect(0, 0, 600, 600);

      // 2. HOTSPOTS
      resourceHotspots.value.forEach(h => {
        const hx = h.x - viewPort.value.x;
        const hy = h.y - viewPort.value.y;
        if (hx > -250 && hx < 850 && hy > -250 && hy < 850) {
          drawHotspot(ctx, h, viewPort.value.x, viewPort.value.y);
        }
      });

      // 3. Game objects
      renderGameObjects(ctx);
    };

    // ------------------------------------------------------------------
    // 6. Reactivity
    // ------------------------------------------------------------------
    watch([resourceHotspots, viewPort, tank, trodes, spheres, projectiles], draw, { deep: true });

    // ------------------------------------------------------------------
    // 7. Lifecycle
    // ------------------------------------------------------------------
    onMounted(async () => {
      highScores.value = await getHighScores();
      await nextTick();

      generateHotspots();
      reset();
      draw();

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    });

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    });

    return {
      mapSize, viewPort, tank, trodes, spheres, projectiles,
      resourceHotspots, navBeacon, flash,
      gctScore, highScores,
      handleClick, reset, draw,
      mainCanvas,
      // eslint-disable-next-line no-unused-vars
      placeTrode,
      // eslint-disable-next-line no-unused-vars
      fireProjectile
    };
  }
};
</script>

<style scoped>
.game-container { 
  text-align: center; 
}
.gameplay-container { 
  position: relative; 
  display: inline-block; 
  /* REMOVED padding-top - minimap overlays directly */
}
canvas { 
  border: 2px solid #8B4513; 
  background: #CC6600; 
  cursor: crosshair; 
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  display: block; 
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