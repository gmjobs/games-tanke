/*
 * 纯逻辑单测（ATDD 支撑）：速度曲线/计分、可行性校验、碰撞与通道判定、世界推进。
 * 这些模块无浏览器/Three.js 依赖，可在 Node 中直接运行。
 */
import { describe, it, expect } from 'vitest';
import { speedAt, scoreOf, SPEED, ROW_GAP, LANE_W } from './config.js';
import { validatePassable, TrackGenerator } from './logic/track.js';
import { checkCollision, collectCoins } from './logic/collision.js';
import { World } from './logic/world.js';

describe('速度曲线与计分（FR-2/FR-6）', () => {
  it('起始速度等于 START，且随时间单调递增', () => {
    expect(speedAt(0)).toBe(SPEED.start);
    expect(speedAt(5)).toBeGreaterThan(speedAt(0));
  });
  it('速度封顶不超过 MAX（AC-2.3）', () => {
    expect(speedAt(99999)).toBe(SPEED.max);
  });
  it('分数 = floor(距离) + 金币*10', () => {
    expect(scoreOf(123.7, 4)).toBe(123 + 40);
  });
});

describe('赛道可行性校验（AC-4.2）', () => {
  it('存在空车道时可通过', () => {
    expect(validatePassable({ obstacles: [{ lane: -1, kind: 'block' }, { lane: 0, kind: 'block' }] })).toBe(true);
  });
  it('全宽同种可跳/可滑障碍可通过', () => {
    expect(validatePassable({ obstacles: [-1, 0, 1].map((l) => ({ lane: l, kind: 'low' })) })).toBe(true);
  });
  it('全宽实心墙判为不可通过', () => {
    expect(validatePassable({ obstacles: [-1, 0, 1].map((l) => ({ lane: l, kind: 'block' })) })).toBe(false);
  });
  it('生成器产出的所有 cell 均可通过（无死局）', () => {
    const g = new TrackGenerator();
    g.ensureAhead(0, 600);
    for (const c of g.cells) expect(validatePassable(c)).toBe(true);
  });
});

describe('碰撞与通道判定（FR-5）', () => {
  const cell = { index: 0, obstacles: [{ lane: 0, kind: 'block' }, { lane: 1, kind: 'low' }, { lane: -1, kind: 'high' }] };
  const center = ROW_GAP / 2;
  const base = { s: center, lane: 0, y: 0, sliding: false };

  it('同车道实心块必撞', () => {
    expect(checkCollision({ ...base, lane: 0 }, cell)).toBe('collision');
  });
  it('不同车道不撞', () => {
    expect(checkCollision({ ...base, lane: 0, s: center + 5 }, cell)).toBe(null);
  });
  it('矮栏需跳过：高度不足撞，足够则过', () => {
    expect(checkCollision({ ...base, lane: 1, y: 0 }, cell)).toBe('collision');
    expect(checkCollision({ ...base, lane: 1, y: 1.5 }, cell)).toBe(null);
  });
  it('高栏需滑铲：不滑撞，滑则过', () => {
    expect(checkCollision({ ...base, lane: -1, sliding: false }, cell)).toBe('collision');
    expect(checkCollision({ ...base, lane: -1, sliding: true }, cell)).toBe(null);
  });
  it('金币自动收集且不重复计', () => {
    const coinCell = { index: 0, coins: [{ lane: 0, collected: false }] };
    const p = { s: center, lane: 0, y: 0 };
    expect(collectCoins(p, coinCell)).toBe(1);
    expect(collectCoins(p, coinCell)).toBe(0); // 已收集
  });
});

describe('世界推进与玩家控制（FR-2/FR-3/FR-7）', () => {
  it('变道在合法范围内并越界忽略（AC-3.8）', () => {
    const w = new World();
    w.applyIntent('left'); expect(w.player.targetLane).toBe(-1);
    w.applyIntent('left'); expect(w.player.targetLane).toBe(-1); // 不越界
    w.applyIntent('right'); w.applyIntent('right'); expect(w.player.targetLane).toBe(1);
  });
  it('地面起跳进入空中，落地恢复', () => {
    const w = new World();
    w.applyIntent('jump');
    expect(w.player.onGround).toBe(false);
    for (let i = 0; i < 600; i++) w.update(1 / 120); // 推进直到落地
    expect(w.player.onGround).toBe(true);
  });
  it('持续推进：距离递增、分数非负、长跑不抛异常（NFR-8）', () => {
    const w = new World();
    let last = 0;
    for (let i = 0; i < 5000 && !w.over; i++) {
      w.update(1 / 120);
      expect(w.distance).toBeGreaterThanOrEqual(last);
      last = w.distance;
    }
    expect(w.score).toBeGreaterThanOrEqual(0);
  });
  it('reset 完全复位（AC-7.3）', () => {
    const w = new World();
    for (let i = 0; i < 300; i++) w.update(1 / 120);
    w.reset();
    expect(w.distance).toBe(0);
    expect(w.coins).toBe(0);
    expect(w.over).toBe(false);
    expect(w.player.lane).toBe(0);
  });
});
