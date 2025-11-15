// src/composables/useGameInput.js
import { saveScore } from '@/firebase';

export function useGameInput({
  tank, trodes, projectiles, navBeacon, resourceHotspots,
  gctScore, pressedKeys, updateViewPort,
  mainCanvas, mapSize, viewPort, reset, spheres
}) {
  // ------------------------------------------------------------------
  // Helper utilities
  // ------------------------------------------------------------------
  const normalizeAngle = diff => {
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  };

  // ------------------------------------------------------------------
  // Input handling – use .value!
  // ------------------------------------------------------------------
  const handleKeyDown = e => {
    const k = e.key.toLowerCase();
    if (k === 'r') { 
      reset(); 
      return; 
    }
    if (k === 'control' && tank.value.trodesCarried > 0) { 
      placeTrode(); 
      return; 
    }
    if (k === ' ') { 
      e.preventDefault(); 
      fireProjectile(); 
      return; 
    }
    if (k === 'q') {
      tank.value.turretAngle -= 0.15;
      return;
    }
    if (k === 'e') {
      tank.value.turretAngle += 0.15;
      return;
    }
    pressedKeys.value.add(k);
  };

  const handleKeyUp = e => pressedKeys.value.delete(e.key.toLowerCase());  // FIXED: .delete → .delete

  // ------------------------------------------------------------------
  // Click → nav beacon
  // ------------------------------------------------------------------
  const handleClick = e => {
    if (!mainCanvas.value) return;
    const rect = mainCanvas.value.getBoundingClientRect();
    const mx = e.clientX - rect.left + viewPort.value.x;
    const my = e.clientY - rect.top + viewPort.value.y;
    navBeacon.value = {
      x: Math.max(0, Math.min(mapSize.value.w, mx)),
      y: Math.max(0, Math.min(mapSize.value.h, my))
    };
    updateViewPort();
  };

  // ------------------------------------------------------------------
  // Trode placement
  // ------------------------------------------------------------------
  const findNearestHotspot = (tx, ty) => {
    let nearest = null, minDist = Infinity;
    for (const h of resourceHotspots.value) {
      const d = Math.hypot(tx - h.x, ty - h.y);
      if (d < h.radius && d < minDist) { minDist = d; nearest = h; }
    }
    return nearest;
  };

  const placeTrode = () => {
    if (tank.value.trodesCarried <= 0) return;  // FIXED: tank.value
    const hotspot = findNearestHotspot(tank.value.x, tank.value.y);  // FIXED: tank.value
    trodes.value.push({
      x: tank.value.x, y: tank.value.y,  // FIXED
      energy: 15.0, mined: 0,
      resource: hotspot ? hotspot.resource : null,
      miningArea: { x: tank.value.x - 50, y: tank.value.y - 50, w: 100, h: 100 }
    });
    tank.value.trodesCarried--;  // FIXED
  };

  // ------------------------------------------------------------------
  // Projectile
  // ------------------------------------------------------------------
  const fireProjectile = () => {
    const bl = 35;
    projectiles.value.push({
      x: tank.value.x + bl * Math.cos(tank.value.turretAngle),
      y: tank.value.y + bl * Math.sin(tank.value.turretAngle),
      angle: tank.value.turretAngle,
      speed: 400,
      lifetime: 2
    });
  };

  // ------------------------------------------------------------------
  // Collection & scoring
  // ------------------------------------------------------------------
  const checkCollection = () => {
    let harvested = false;
    spheres.value = spheres.value.filter(s => {
      if (Math.hypot(tank.value.x - s.x, tank.value.y - s.y) < 20) {  // FIXED
        gctScore.value += s.resource.value;
        harvested = true;
        return false;
      }
      return true;
    });
    if (harvested && gctScore.value >= 5) {
      saveScore(gctScore.value);
    }
  };

  return {
    handleKeyDown, handleKeyUp, handleClick,
    placeTrode, fireProjectile, checkCollection,
    normalizeAngle
  };
}