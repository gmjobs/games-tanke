/*
 * 碰撞与失败判定（FR-5）。纯逻辑，基于世界坐标，保证判定与画面一致（AC-5.3）。
 */
import { ROW_GAP, OBST_HALF_Z, COIN_HALF_Z, JUMP_CLEAR } from '../config.js';

// 检测玩家与当前所在 cell 障碍的碰撞；返回 'collision' 或 null
export function checkCollision(player, cell) {
  if (!cell || !cell.obstacles.length) return null;
  const cellCenter = cell.index * ROW_GAP + ROW_GAP / 2;
  // 玩家纵向位置（沿路径距离）落在障碍判定带内才检测
  if (Math.abs(player.s - cellCenter) > OBST_HALF_Z) return null;
  for (const o of cell.obstacles) {
    if (o.lane !== player.lane) continue;
    switch (o.kind) {
      case 'low': // 矮栏：必须跳过（高度不足则撞）
        if (player.y < JUMP_CLEAR) return 'collision';
        break;
      case 'high': // 高栏：必须滑铲通过
        if (!player.sliding) return 'collision';
        break;
      case 'block':
      case 'wall': // 实心：同车道必撞（跳/铲均无效）
        return 'collision';
    }
  }
  return null;
}

// 金币吸收：返回收集到的金币数量，并标记 collected
export function collectCoins(player, cell) {
  if (!cell || !cell.coins.length) return 0;
  const cellCenter = cell.index * ROW_GAP + ROW_GAP / 2;
  if (Math.abs(player.s - cellCenter) > COIN_HALF_Z) return 0;
  let got = 0;
  for (const c of cell.coins) {
    if (c.collected) continue;
    if (c.lane !== player.lane) continue;
    // 弧形金币需在空中才吃到，普通金币地面吃到
    if (c.arc && player.y < JUMP_CLEAR * 0.5) continue;
    c.collected = true;
    got++;
  }
  return got;
}
