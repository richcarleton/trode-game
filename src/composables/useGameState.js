// src/composables/useGameState.js
import { ref, nextTick } from 'vue';

const TANK_SPEED = 200;
const ROT_SPEED = 2;
const PROJECTILE_SPEED = 400;
const DEPLETION_RATE = 40 / 60;

export function useGameState({ gctScore }) {
  const mapSize = ref({ w: 1200, h: 1200 });
  const viewPort = ref({ x: 0, y: 0, w: 600, h: 600 });

  const tank = ref({ x: 600, y: 600, angle: 0, turretAngle: 0, speed: TANK_SPEED, trodesCarried: 8 });
  const trodes = ref([]);
  const spheres = ref([]);
  const projectiles = ref([]);
  const resourceHotspots = ref([]);
  const navBeacon = ref(null);
  const flash = ref({ color: null, timer: 0 });

  const lastTime = ref(0);
  const pressedKeys = ref(new Set());
  const leftTreadOffset = ref(0);
  const rightTreadOffset = ref(0);
  const currentForwardSpeed = ref(0);
  const currentRotationSpeed = ref(0);
  const lastPosition = ref({ x: 600, y: 600 });
  const stuckTimer = ref(0);

  const reset = async () => {
    tank.value = { x: 600, y: 600, angle: 0, turretAngle: 0, speed: TANK_SPEED, trodesCarried: 8 };
    trodes.value = []; spheres.value = []; projectiles.value = [];
    navBeacon.value = null; gctScore.value = 0;
    currentForwardSpeed.value = currentRotationSpeed.value = 0;
    leftTreadOffset.value = rightTreadOffset.value = 0;
    lastPosition.value = { x: 600, y: 600 }; stuckTimer.value = 0;
    updateViewPort();
    await nextTick();
  };

  const updateViewPort = () => {
    viewPort.value.x = tank.value.x - viewPort.value.w / 2;
    viewPort.value.y = tank.value.y - viewPort.value.h / 2;
    viewPort.value.x = Math.max(0, Math.min(mapSize.value.w - viewPort.value.w, viewPort.value.x));
    viewPort.value.y = Math.max(0, Math.min(mapSize.value.h - viewPort.value.h, viewPort.value.y));
  };

  const clampTank = () => {
    tank.value.x = Math.max(0, Math.min(mapSize.value.w, tank.value.x));
    tank.value.y = Math.max(0, Math.min(mapSize.value.h, tank.value.y));
  };

  return {
    mapSize, viewPort, tank, trodes, spheres, projectiles,
    resourceHotspots, navBeacon, flash,
    lastTime, pressedKeys, leftTreadOffset, rightTreadOffset,
    currentForwardSpeed, currentRotationSpeed, lastPosition, stuckTimer,
    reset, updateViewPort, clampTank,
    TANK_SPEED, ROT_SPEED, PROJECTILE_SPEED, DEPLETION_RATE
  };
}