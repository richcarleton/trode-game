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
import { useGameRender } from '@/composables/useGameRender';
import { useGameLogic } from '@/composables/useGameLogic';
import { useHotspotGenerator } from '@/composables/useHotspotGenerator';
import { getHighScores } from '@/firebase';

export default {
  name: 'TrodeGame',
  components: { Minimap },
  setup() {
    const mainCanvas = ref(null);
    const gctScore = ref(0);
    const highScores = ref([]);

    // 1. Game State
    const {
      mapSize, viewPort, tank, trodes, spheres, projectiles,
      resourceHotspots, navBeacon, flash,
      pressedKeys, leftTreadOffset, rightTreadOffset,
      currentForwardSpeed, currentRotationSpeed, lastPosition, stuckTimer,
      reset, updateViewPort, clampTank,
      TANK_SPEED, ROT_SPEED, DEPLETION_RATE
    } = useGameState({ gctScore });

    // 2. Input
    const {
      handleKeyDown, handleKeyUp, handleClick,
      placeTrode, fireProjectile, checkCollection,
      normalizeAngle
    } = useGameInput({
      tank, trodes, projectiles, navBeacon, resourceHotspots,
      gctScore, pressedKeys, updateViewPort,
      mainCanvas, mapSize, viewPort, reset, spheres
    });

    // 3. Render
    const { renderGameObjects } = useGameRender({
      mainCanvas, viewPort, tank, trodes, spheres,
      projectiles, flash, leftTreadOffset, rightTreadOffset
    });

    // 4. Logic
    const { stop: stopLoop } = useGameLogic({
      mainCanvas, mapSize, tank, trodes, spheres, projectiles,
      navBeacon, pressedKeys, leftTreadOffset, rightTreadOffset,
      currentForwardSpeed, currentRotationSpeed, lastPosition, stuckTimer,
      TANK_SPEED, ROT_SPEED, DEPLETION_RATE,
      clampTank, updateViewPort, checkCollection, normalizeAngle,
      renderGameObjects, flash
    });

    // 5. Hotspots
    const { generateHotspots, drawHotspot } = useHotspotGenerator({ resourceHotspots });

    // 6. Full draw
    const draw = () => {
      if (!mainCanvas.value) return;
      const ctx = mainCanvas.value.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 600, 600);

      ctx.fillStyle = '#CC6600';
      ctx.fillRect(0, 0, 600, 600);

      resourceHotspots.value.forEach(h => {
        const hx = h.x - viewPort.value.x;
        const hy = h.y - viewPort.value.y;
        if (hx > -250 && hx < 850 && hy > -250 && hy < 850) {
          drawHotspot(ctx, h, viewPort.value.x, viewPort.value.y);
        }
      });

      renderGameObjects(ctx);
    };

    // 7. Reactivity
    watch([resourceHotspots, viewPort, tank, trodes, spheres, projectiles], draw, { deep: true });

    // 8. Lifecycle
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
      stopLoop();
    });

    return {
      mapSize, viewPort, tank, trodes, spheres, projectiles,
      resourceHotspots, navBeacon, flash,
      gctScore, highScores,
      handleClick, reset, draw,
      mainCanvas, placeTrode, fireProjectile
    };
  }
};
</script>

<style scoped>
.game-container { text-align: center; }
.gameplay-container { position: relative; display: inline-block; top:40px; }
canvas { border: 2px solid #8B4513; background:#CC6600; cursor:crosshair; image-rendering:pixelated; image-rendering:-moz-crisp-edges; display:block; }
.ui { margin-top:10px; color:#FFCC00; font-family:monospace; }
button { background:#8B4513; color:#FFCC00; border:1px solid #CC6600; padding:8px 16px; margin:5px; cursor:pointer; }
.highscores { margin-top:20px; color:#00FFFF; text-align:left; max-height:200px; overflow-y:auto; }
</style>