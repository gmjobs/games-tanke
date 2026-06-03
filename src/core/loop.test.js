/*
 * 主循环单测（NFR-1/NFR-3）：固定步长 update + 渲染插值 + 帧时限幅。
 * 逻辑与帧率解耦的核心保证（不同设备物理一致、无大跨步穿模、防螺旋死亡）。
 * 直接驱动 _tick(now)，避免依赖 rAF 真实回调（仅以 noop 桩满足末尾预约）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameLoop } from './loop.js';
import { FIXED_DT, MAX_FRAME } from '../config.js';

beforeEach(() => {
  // _tick 末尾会预约下一帧；测试中以 noop 桩满足该调用
  globalThis.requestAnimationFrame = vi.fn(() => 1);
  globalThis.cancelAnimationFrame = vi.fn();
});

function makeLoop() {
  const update = vi.fn();
  const render = vi.fn();
  const onFrame = vi.fn();
  const loop = new GameLoop({ update, render, onFrame });
  loop._running = true;        // 跳过 start()（其依赖 performance.now）
  loop._last = 0;
  loop._acc = 0;
  return { loop, update, render, onFrame };
}

describe('固定步长累加器（NFR-1/3）', () => {
  it('按固定步长推进逻辑：50ms 帧 ≈ 6 个 1/120s 步', () => {
    const { loop, update, render } = makeLoop();
    loop._tick(50); // dt=0.05s
    const expectedSteps = Math.floor(0.05 / FIXED_DT); // = 6
    expect(update).toHaveBeenCalledTimes(expectedSteps);
    expect(update).toHaveBeenCalledWith(FIXED_DT); // 每步都是固定 dt
    expect(render).toHaveBeenCalledTimes(1);        // 每帧渲染一次
  });

  it('渲染插值因子 alpha ∈ [0,1)', () => {
    const { loop, render } = makeLoop();
    loop._tick(20); // dt=0.02s，无法整除 FIXED_DT，残留 -> alpha
    const alpha = render.mock.calls[0][0];
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
  });

  it('单帧 dt 限幅到 MAX_FRAME，且步数封顶 8（防螺旋死亡 / 卡顿后不穿模）', () => {
    const { loop, update } = makeLoop();
    loop._tick(5000); // 卡顿 5s，dt 应被限幅到 MAX_FRAME=0.1
    // 0.1 / (1/120) = 12 步，但被 steps<8 封顶
    expect(update).toHaveBeenCalledTimes(8);
    expect(MAX_FRAME).toBe(0.1);
  });

  it('onFrame 收到真实帧时长（供 FPS 采样 / HUD）', () => {
    const { loop, onFrame } = makeLoop();
    loop._tick(16); // ~60fps 帧
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onFrame.mock.calls[0][0]).toBeCloseTo(0.016, 3);
  });

  it('stop 后再次 tick 不推进（暂停/失焦止损）', () => {
    const { loop, update } = makeLoop();
    loop.stop();
    loop._tick(50);
    expect(update).not.toHaveBeenCalled();
  });

  it('累计余量跨帧保留，逻辑步与帧率解耦', () => {
    const { loop, update } = makeLoop();
    loop._tick(5);   // 0.005s < FIXED_DT，攒着不足一步
    expect(update).toHaveBeenCalledTimes(0);
    loop._tick(10);  // 再来 0.005s（now 累进），合计可凑出步数
    expect(update.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
