// src/composables/useGameLogic.js
import { watch, nextTick } from 'vue';

export function useGameLogic({
  mainCanvas, mapSize, tank, trodes, spheres, projectiles,
  navBeacon, pressedKeys, leftTreadOffset, rightTreadOffset,
  currentForwardSpeed, currentRotationSpeed, lastPosition, stuckTimer,
  TANK_SPEED, ROT_SPEED, DEPLETION_RATE,
  clampTank, updateViewPort, checkCollection, normalizeAngle,
  renderGameObjects, flash
}) {
  let animationId = null;
  const lastTime = { value: 0 };

  const gameLoop = now => {
    if (!lastTime.value) lastTime.value = now;
    const dt = now - lastTime.value;
    const ds = Math.min(dt / 1000, 0.05);
    lastTime.value = now;

    // INPUT
    let fwd = 0, rot = 0;
    if (pressedKeys.value.has('w') || pressedKeys.value.has('arrowup')) fwd += 1;
    if (pressedKeys.value.has('s') || pressedKeys.value.has('arrowdown')) fwd -= 1;
    if (pressedKeys.value.has('a') || pressedKeys.value.has('arrowleft')) rot -= 1;
    if (pressedKeys.value.has('d') || pressedKeys.value.has('arrowright')) rot += 1;
    const manual = fwd || rot;
    if (manual && navBeacon.value) navBeacon.value = null;

    // TARGET SPEEDS
    let targetF = 0, targetR = 0;
    if (manual) {
      targetF = fwd * TANK_SPEED;
      targetR = rot * ROT_SPEED;
    } else if (navBeacon.value) {
      const dx = navBeacon.value.x - tank.value.x;
      const dy = navBeacon.value.y - tank.value.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 5) {
        navBeacon.value = null;
      } else {
        const a = Math.atan2(dy, dx);
        let diff = normalizeAngle(a - tank.value.angle);
        if (Math.abs(diff) < 0.05) diff = 0;
        const stop = TANK_SPEED * 0.1;
        const close = stop * 2;
        if (dist < close) targetR = 0;
        else {
          const turn = 2;
          const adj = Math.sign(diff) * Math.min(Math.abs(diff), turn * ds);
          targetR = adj / ds;
        }
        const ff = Math.cos(diff);
        targetF = TANK_SPEED * Math.max(0, ff) * Math.min(1, dist / stop);
      }
    }

    // ACCELERATION
    const ease = 0.1;
    const fAcc = TANK_SPEED / ease;
    const rAcc = ROT_SPEED / ease;
    const fΔ = fAcc * ds;
    const rΔ = rAcc * ds;
    currentForwardSpeed.value = currentForwardSpeed.value < targetF
      ? Math.min(currentForwardSpeed.value + fΔ, targetF)
      : Math.max(currentForwardSpeed.value - fΔ, targetF);
    currentRotationSpeed.value = currentRotationSpeed.value < targetR
      ? Math.min(currentRotationSpeed.value + rΔ, targetR)
      : Math.max(currentRotationSpeed.value - rΔ, targetR);

    // MOVE TANK
    tank.value.angle += currentRotationSpeed.value * ds;
    tank.value.x += currentForwardSpeed.value * Math.cos(tank.value.angle) * ds;
    tank.value.y += currentForwardSpeed.value * Math.sin(tank.value.angle) * ds;
    clampTank();

    // STUCK CHECK
    if (navBeacon.value) {
      const dB = Math.hypot(navBeacon.value.x - tank.value.x, navBeacon.value.y - tank.value.y);
      const moved = Math.hypot(tank.value.x - lastPosition.value.x, tank.value.y - lastPosition.value.y);
      if (dB < 50 && moved < 1) {
        stuckTimer.value += ds;
        if (stuckTimer.value > 0.5) {
          navBeacon.value = null;
          currentForwardSpeed.value = currentRotationSpeed.value = 0;
          stuckTimer.value = 0;
        }
      } else {
        stuckTimer.value = 0;
      }
    }
    lastPosition.value = { x: tank.value.x, y: tank.value.y };

    // TREAD ANIMATION
    const halfW = 23, rate = 20;
    const lSp = currentForwardSpeed.value - currentRotationSpeed.value * halfW;
    const rSp = currentForwardSpeed.value + currentRotationSpeed.value * halfW;
    if (Math.abs(lSp) > 0.01) {
      leftTreadOffset.value += (lSp / TANK_SPEED) * -rate * ds;
      leftTreadOffset.value = (leftTreadOffset.value % 5 + 5) % 5;
    }
    if (Math.abs(rSp) > 0.01) {
      rightTreadOffset.value += (rSp / TANK_SPEED) * -rate * ds;
      rightTreadOffset.value = (rightTreadOffset.value % 5 + 5) % 5;
    }

    // PROJECTILES
    projectiles.value = projectiles.value.filter(p => {
      p.x += p.speed * Math.cos(p.angle) * ds;
      p.y += p.speed * Math.sin(p.angle) * ds;
      p.lifetime -= ds;
      for (let i = 0; i < trodes.value.length; i++) {
        const t = trodes.value[i];
        if (Math.hypot(p.x - t.x, p.y - t.y) < 20) {
          t.energy += 5;
          flash.value = { color: [0, 255, 0], timer: 5 };
          return false;
        }
      }
      return p.lifetime > 0 && p.x >= 0 && p.x <= mapSize.value.w && p.y >= 0 && p.y <= mapSize.value.h;
    });

    // Trode mining
    for (let i = trodes.value.length - 1; i >= 0; i--) {
      const t = trodes.value[i];
      if (t.energy > 0) {
        const dep = DEPLETION_RATE * ds;
        t.energy = Math.max(0, t.energy - dep);
        t.mined += dep;
        while (t.mined >= 15 && t.resource) {
          spheres.value.push({
            x: t.miningArea.x + Math.random() * t.miningArea.w,
            y: t.miningArea.y + Math.random() * t.miningArea.h,
            resource: t.resource
          });
          t.mined -= 15;
        }
        if (t.energy <= 0) trodes.value.splice(i, 1);
      }
    }

    updateViewPort();
    checkCollection();

    if (mainCanvas.value) {
      const ctx = mainCanvas.value.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      renderGameObjects(ctx);
    }

    animationId = requestAnimationFrame(gameLoop);
  };

  // START / STOP
  watch(mainCanvas, async canvas => {
    if (canvas) {
      await nextTick();
      if (animationId) cancelAnimationFrame(animationId);
      animationId = requestAnimationFrame(gameLoop);
    }
  }, { immediate: true });

  const stop = () => {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
  };

  return { stop };
}