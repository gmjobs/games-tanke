/*
 * 赛道生成器（FR-4）。纯逻辑、无渲染依赖。
 * 模型：赛道由若干 cell 组成，每个 cell 沿“路径”前进 ROW_GAP 长度。
 * 路径可在转弯 cell 处改变朝向（±90°），从而实现真正的左右转弯。
 * 每个 cell 携带障碍/金币，并经过可行性校验（AC-4.2）保证存在可通过路线。
 */
import { ROW_GAP, LANES } from '../config.js';

// 朝向 -> 前进单位向量 (x,z)。h 为弧度，前向 = (sin h, cos h)
export function forwardVec(h) { return { x: Math.sin(h), z: Math.cos(h) }; }
// 朝向 -> 右向单位向量（前向顺时针转 90°）
export function rightVec(h) { return { x: Math.cos(h), z: -Math.sin(h) }; }

let _seed = 1;
function rand() { // 确定性伪随机，便于复现/调试（避免 Math.random 不可控）
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
function ri(n) { return Math.floor(rand() * n); }
function pick(arr) { return arr[ri(arr.length)]; }

// 障碍：kind = block(必须变道) | low(可跳) | high(可滑) | wall(必须变道)
function obstacle(lane, kind) { return { lane, kind }; }

// 可行性校验：保证至少一条可通过路线（AC-4.2）
export function validatePassable(cell) {
  if (!cell.obstacles.length) return true;
  const byLane = [null, null, null]; // index 0/1/2 -> lane -1/0/1
  for (const o of cell.obstacles) byLane[o.lane + 1] = o.kind;
  // 若某条车道无障碍 -> 可直接通过
  if (byLane.some((k) => k === null)) return true;
  // 三车道都有障碍：必须全部为同一种“可跳/可滑”障碍，否则不可解
  const kinds = new Set(byLane);
  if (kinds.size === 1 && (byLane[0] === 'low' || byLane[0] === 'high')) return true;
  return false;
}

export class TrackGenerator {
  constructor() { this.reset(); }

  reset(seed = 1) {
    _seed = seed >>> 0 || 1;
    this.cells = [];          // 已生成 cell（按 index 顺序）
    this.firstIndex = 0;      // 仍保留在内存中的最小 index（之前的已回收）
    this.cursor = { x: 0, z: 0, h: 0 }; // 下一个 cell 的起点与朝向
    this.sinceTurn = 0;       // 距上次转弯的 cell 数
    this.sinceObstacle = 0;
    // 预生成起步安全区（无障碍直道）
    for (let i = 0; i < 12; i++) this._appendCell(true);
  }

  // 当前应保证生成到 cameraS+maxAhead 距离对应的 cell
  ensureAhead(s, maxAhead) {
    const need = Math.ceil((s + maxAhead) / ROW_GAP) + 2;
    while (this.cells.length + this.firstIndex < need) this._appendCell(false);
  }

  // 回收落在身后的 cell（仅释放逻辑引用，渲染层各自回收网格）
  recycleBehind(s) {
    const keepFrom = Math.floor(s / ROW_GAP) - 3;
    while (this.firstIndex < keepFrom && this.cells.length) {
      this.cells.shift();
      this.firstIndex++;
    }
  }

  get(index) {
    const i = index - this.firstIndex;
    return (i >= 0 && i < this.cells.length) ? this.cells[i] : null;
  }

  // 由路径距离 s 求世界变换 {x,z,h, cell, local}
  transformAt(s) {
    const index = Math.floor(s / ROW_GAP);
    const cell = this.get(index) || this.cells[this.cells.length - 1];
    const local = s - cell.index * ROW_GAP;
    const f = forwardVec(cell.h);
    return { x: cell.start.x + f.x * local, z: cell.start.z + f.z * local, h: cell.h, cell, local };
  }

  _appendCell(safe) {
    const index = this.firstIndex + this.cells.length;
    const start = { x: this.cursor.x, z: this.cursor.z };
    const h = this.cursor.h;

    let type = 'straight';
    let turnDir = 0;
    const obstacles = [];
    const coins = [];

    // 转弯：起步安全区之后，间隔足够远才出现，且转弯前后留出决策/缓冲空间
    if (!safe && this.sinceTurn > 6 && rand() < 0.16) {
      type = rand() < 0.5 ? 'turn-left' : 'turn-right';
      turnDir = type === 'turn-left' ? -1 : 1;
      this.sinceTurn = 0;
    } else {
      this.sinceTurn++;
      // 障碍 / 金币（仅直道、非紧邻转弯）
      if (!safe && this.sinceTurn > 1 && this.sinceObstacle > 1 && rand() < 0.62) {
        this._fillObstacles(obstacles, coins);
        this.sinceObstacle = 0;
      } else {
        this.sinceObstacle++;
        if (rand() < 0.5) this._fillCoins(coins);
      }
    }

    const cell = {
      index, type, turnDir, start, h,
      obstacles, coins,
      passable: true,
    };
    // 可行性兜底：若意外不可解则清空障碍（绝不产出死局）
    if (!validatePassable(cell)) { cell.obstacles = []; }
    cell.passable = true;

    this.cells.push(cell);

    // 推进路径游标：转弯 cell 走完后改变朝向
    const f = forwardVec(h);
    this.cursor.x = start.x + f.x * ROW_GAP;
    this.cursor.z = start.z + f.z * ROW_GAP;
    if (turnDir !== 0) this.cursor.h = h + turnDir * (Math.PI / 2);

    return cell;
  }

  _fillObstacles(obstacles, coins) {
    const pattern = ri(6);
    switch (pattern) {
      case 0: // 单车道实心块
        obstacles.push(obstacle(pick(LANES.map((_, i) => i - 1)), 'block'));
        break;
      case 1: // 两车道实心块，留一条
        {
          const open = ri(3) - 1;
          for (const l of [-1, 0, 1]) if (l !== open) obstacles.push(obstacle(l, 'block'));
        }
        break;
      case 2: // 全宽矮栏：跳跃通过
        for (const l of [-1, 0, 1]) obstacles.push(obstacle(l, 'low'));
        // 矮栏上方放金币弧，鼓励跳跃
        coins.push({ lane: 0, arc: true });
        break;
      case 3: // 全宽高栏：滑铲通过
        for (const l of [-1, 0, 1]) obstacles.push(obstacle(l, 'high'));
        break;
      case 4: // 单侧高墙
        obstacles.push(obstacle(ri(2) === 0 ? -1 : 1, 'wall'));
        if (rand() < 0.6) this._fillCoins(coins);
        break;
      default: // 中间矮栏 + 两侧金币
        obstacles.push(obstacle(0, 'low'));
        coins.push({ lane: -1 });
        coins.push({ lane: 1 });
    }
  }

  _fillCoins(coins) {
    const lane = ri(3) - 1;
    coins.push({ lane });
  }
}
