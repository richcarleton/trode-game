// src/composables/useGameRender.js
import { watch, nextTick } from 'vue';

export function useGameRender({
  mainCanvas, viewPort, tank, trodes, spheres, projectiles,
  flash, leftTreadOffset, rightTreadOffset
}) {
  const renderGameObjects = ctx => {
    if (flash.value.timer > 0) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = `rgb(${flash.value.color.join(',')})`;
      ctx.fillRect(0, 0, 600, 600);
      ctx.globalAlpha = 1;
      flash.value.timer--;
    }

    trodes.value.forEach(t => {
      const tx = t.x - viewPort.value.x, ty = t.y - viewPort.value.y;
      if (tx > -50 && tx < 650 && ty > -50 && ty < 650) {
        ctx.save(); ctx.translate(tx, ty);
        ctx.beginPath(); ctx.moveTo(20, 0);
        for (let i = 1; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.lineTo(20 * Math.cos(a), 20 * Math.sin(a));
        }
        ctx.closePath();
        ctx.fillStyle = '#888888'; ctx.fill();
        ctx.strokeStyle = '#444444'; ctx.lineWidth = 2; ctx.stroke();

        const a = t.energy / 15;
        ctx.fillStyle = `rgba(0,255,0,${a})`;
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        const mx = t.miningArea.x - viewPort.value.x;
        const my = t.miningArea.y - viewPort.value.y;
        ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); ctx.strokeRect(mx, my, t.miningArea.w, t.miningArea.h);
        ctx.setLineDash([]);
      }
    });

    spheres.value.forEach(s => {
      const sx = s.x - viewPort.value.x, sy = s.y - viewPort.value.y;
      if (sx > -15 && sx < 615 && sy > -15 && sy < 615) {
        ctx.fillStyle = s.resource.color;
        ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
      }
    });

    projectiles.value.forEach(p => {
      const px = p.x - viewPort.value.x, py = p.y - viewPort.value.y;
      if (px > -10 && px < 610 && py > -10 && py < 610) {
        ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(px, py);
        const trail = 10;
        ctx.lineTo(px - trail * Math.cos(p.angle), py - trail * Math.sin(p.angle));
        ctx.stroke();
        ctx.globalAlpha = 0.5; ctx.lineWidth = 5; ctx.stroke(); ctx.globalAlpha = 1;
      }
    });

    const tx = tank.value.x - viewPort.value.x, ty = tank.value.y - viewPort.value.y;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(tank.value.angle);
    const treadL = 60, thick = 10, step = 5, phase = step / 2;
    const lShift = (leftTreadOffset.value + phase) % step;
    const rShift = rightTreadOffset.value % step;

    ctx.fillStyle = '#333333'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 2;
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
  };

  watch(mainCanvas, async canvas => {
    if (canvas) {
      await nextTick();
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      renderGameObjects(ctx);
    }
  }, { immediate: true });

  return { renderGameObjects };
}