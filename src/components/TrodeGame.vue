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

    // ------------------------------------------------------------------
    // 1. Game logic – returns renderGameObjects(ctx)
    // ------------------------------------------------------------------
    const {
      mapSize, viewPort, tank, trodes, spheres, projectiles,
      resourceHotspots, navBeacon, flash,
      reset, handleClick,
      handleKeyDown, handleKeyUp,
      renderGameObjects
    } = useGameLogic({ mainCanvas, gctScore });

    // ------------------------------------------------------------------
    // 2. Hotspot generator
    // ------------------------------------------------------------------
    const { generateHotspots, drawHotspot } = useHotspotGenerator({
      resourceHotspots,
      mapSize
    });

    // ------------------------------------------------------------------
    // 3. FULL DRAW – background + hotspots + game objects
    // ------------------------------------------------------------------
    const draw = () => {
      if (!mainCanvas.value) return;

      const ctx = mainCanvas.value.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 600, 600);

      // 1. Background
      ctx.fillStyle = '#CC6600';
      ctx.fillRect(0, 0, 600, 600);

      // 2. HOTSPOTS (first, under everything)
      resourceHotspots.value.forEach(h => {
        const hx = h.x - viewPort.value.x;
        const hy = h.y - viewPort.value.y;
        if (hx > -250 && hx < 850 && hy > -250 && hy < 850) {
          drawHotspot(ctx, h, viewPort.value.x, viewPort.value.y);
        }
      });

      // 3. Game objects (trodes, spheres, tank, etc.)
      renderGameObjects(ctx);
    };

    // ------------------------------------------------------------------
    // 4. React to changes
    // ------------------------------------------------------------------
    watch([resourceHotspots, viewPort, tank, trodes, spheres, projectiles], () => {
      draw();
    }, { deep: true });

    // ------------------------------------------------------------------
    // 5. Lifecycle
    // ------------------------------------------------------------------
    onMounted(async () => {
      highScores.value = await getHighScores();
      await nextTick();

      generateHotspots();
      reset();
      draw();  // initial draw

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
      mainCanvas
    };
  }
};
</script>

<style scoped>
.game-container { text-align:center; }
.gameplay-container { position:relative; display:inline-block; }
canvas { 
  border:2px solid #8B4513; 
  background:#CC6600; 
  cursor:crosshair; 
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
}
.minimap-container { position:absolute; top:10px; left:50%; transform:translateX(-50%); }
.ui { margin-top:10px; color:#FFCC00; font-family:monospace; }
button { background:#8B4513; color:#FFCC00; border:1px solid #CC6600; padding:8px 16px; margin:5px; cursor:pointer; }
.highscores { margin-top:20px; color:#00FFFF; text-align:left; max-height:200px; overflow-y:auto; }
</style>