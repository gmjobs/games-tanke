/*
 * 路口转向、冲出赛道与玩家动作进阶单测（FR-3/FR-5）。
 * 用「可控的假赛道」替换 World 内部生成器，得到确定性的路口场景，
 * 从而精确验证：转向武装、漏转出界、临界越障/滑铲、二段跳规则、暂停/结束输入屏蔽。
 */
import { describe, it, expect } from 'vitest';
import { World } from './world.js';
import { checkCollision, collectCoins } from './collision.js';
import { ROW_GAP, JUMP_CLEAR, SLIDE_T } from '../config.js';

// 构造仅含直道、在 turnIndex 处有一个转弯的假赛道（无障碍，便于隔离转向逻辑）
function fakeTrack(turnIndex, turnDir) {
  const cell = (index) => ({
    index,
    type: index === turnIndex ? (turnDir < 0 ? 'turn-left' : 'turn-right') : 'straight',
    turnDir: index === turnIndex ? turnDir : 0,
    start: { x: 0, z: 0 }, h: 0,
    obstacles: [], coins: [], passable: true,
  });
  const cache = new Map();
  return {
    ensureAhead() {}, recycleBehind() {},
    get(i) { if (i < 0) return null; if (!cache.has(i)) cache.set(i, cell(i)); return cache.get(i); },
  };
}

function newWorldOnFakeTrack(turnIndex = 3, turnDir = -1) {
  const w = new World();
  w.track = fakeTrack(turnIndex, turnDir); // 覆盖真实生成器
  return w;
}

describe('路口转向武装（AC-3.1）', () => {
  it('接近左转路口时发出 turnPrompt 且自动回中', () => {
    const w = newWorldOnFakeTrack(3, -1);
    w.player.targetLane = 1; // 先偏到右道
    let prompted = false;
    for (let i = 0; i < 400 && !w.over; i++) {
      const evs = w.update(1 / 120);
      if (evs.some((e) => e.type === 'turnPrompt')) prompted = true;
      if (w.activeTurn) { expect(w.player.targetLane).toBe(0); break; } // 接近路口自动回中
    }
    expect(prompted).toBe(true);
  });

  it('在路口按对应方向 -> 武装转向，安全通过不失败（AC-3.1）', () => {
    const w = newWorldOnFakeTrack(3, -1); // 左转
    for (let i = 0; i < 600 && !w.over; i++) {
      const intents = [];
      if (w.activeTurn && w.player.armedTurnIndex !== w.activeTurn.index) intents.push({ type: 'left' });
      w.update(1 / 120, intents);
      if (w.player.s > (4 + 1) * ROW_GAP) break; // 已越过路口
    }
    expect(w.over).toBe(false);
    expect(w.player.armedTurnIndex).toBe(3);
  });

  it('路口不转向 -> 冲出赛道失败（AC-3.7/AC-5.2）', () => {
    const w = newWorldOnFakeTrack(3, -1);
    for (let i = 0; i < 600 && !w.over; i++) w.update(1 / 120); // 全程无输入
    expect(w.over).toBe(true);
    expect(w.overReason).toBe('offtrack');
  });

  it('在路口按反方向 -> 不武装，仍判出界（AC-3.1 不匹配忽略）', () => {
    const w = newWorldOnFakeTrack(3, -1); // 需要左转
    for (let i = 0; i < 600 && !w.over; i++) {
      const intents = [];
      if (w.activeTurn) intents.push({ type: 'right' }); // 按错方向
      w.update(1 / 120, intents);
    }
    expect(w.over).toBe(true);
    expect(w.overReason).toBe('offtrack');
  });
});

describe('玩家动作进阶规则（AC-3.3/3.10）', () => {
  it('滑铲持续约 SLIDE_T 后自动恢复', () => {
    const w = new World();
    w.applyIntent('slide');
    expect(w.player.sliding).toBe(true);
    let t = 0;
    while (w.player.sliding && t < 2) { w.update(1 / 120); t += 1 / 120; }
    expect(w.player.sliding).toBe(false);
    expect(t).toBeGreaterThanOrEqual(SLIDE_T - 0.05);
  });

  it('空中再次按跳被忽略（AC-3.10 既定规则，无二段跳）', () => {
    const w = new World();
    w.applyIntent('jump');
    const vyAfterFirst = w.player.vy;
    w.update(1 / 120);
    w.applyIntent('jump'); // 空中再跳
    expect(w.player.vy).toBeLessThan(vyAfterFirst); // 仅受重力衰减，未被重置为起跳初速
  });

  it('滑铲中按跳被忽略（互斥，不进入异常态 AC-3.5）', () => {
    const w = new World();
    w.applyIntent('slide');
    w.applyIntent('jump');
    expect(w.player.onGround).toBe(true);  // 未起跳
    expect(w.player.sliding).toBe(true);   // 仍在滑铲
  });
});

describe('暂停/结束时输入屏蔽（AC-8.6/FR-5）', () => {
  it('over 后 applyIntent 与 update 不再改变世界', () => {
    const w = new World();
    w.over = true;
    w.applyIntent('left');
    expect(w.player.targetLane).toBe(0);
    const evs = w.update(1 / 120);
    expect(evs).toEqual([]);
  });
});

describe('碰撞/收集临界补充（AC-5.4/5.5/6.1）', () => {
  const center = ROW_GAP / 2;
  it('矮栏临界：恰好达到 JUMP_CLEAR 即可越过', () => {
    const cell = { index: 0, obstacles: [{ lane: 0, kind: 'low' }] };
    expect(checkCollision({ s: center, lane: 0, y: JUMP_CLEAR - 0.01, sliding: false }, cell)).toBe('collision');
    expect(checkCollision({ s: center, lane: 0, y: JUMP_CLEAR, sliding: false }, cell)).toBe(null);
  });
  it('判定带之外（纵向未到障碍）不触发碰撞，保证判定与画面一致（AC-5.3）', () => {
    const cell = { index: 0, obstacles: [{ lane: 0, kind: 'block' }] };
    expect(checkCollision({ s: center + 3, lane: 0, y: 0, sliding: false }, cell)).toBe(null);
  });
  it('弧形金币需在空中才收集（地面经过不计 AC-6.1）', () => {
    const ground = { s: center, lane: 0, y: 0 };
    expect(collectCoins(ground, { index: 0, coins: [{ lane: 0, arc: true, collected: false }] })).toBe(0);
    const air = { s: center, lane: 0, y: JUMP_CLEAR };
    expect(collectCoins(air, { index: 0, coins: [{ lane: 0, arc: true, collected: false }] })).toBe(1);
  });
});
