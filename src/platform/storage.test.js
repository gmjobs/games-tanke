/*
 * 持久化与可观测性单测（FR-6/NFR-6/NFR-7）。
 * storage 仅存最高分与设置（无个人身份信息）；telemetry 提供 FPS 采样与加载耗时。
 * 这里以内存版 localStorage 桩注入全局，纯前端、无网络。
 */
import { describe, it, expect, beforeEach } from 'vitest';

// 内存版 localStorage（在导入被测模块前装好）
function installMemoryLocalStorage() {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
  };
  return m;
}

const mem = installMemoryLocalStorage();

const { getBest, setBest, getSettings, saveSettings } = await import('./storage.js');
const { createFpsMeter, markBoot, markLoadDone, getLoadMs } = await import('./telemetry.js');

describe('最高分持久化（FR-6/AC-6.4）', () => {
  beforeEach(() => mem.clear());

  it('无历史时最高分初值为 0（AC-6.6）', () => {
    expect(getBest()).toBe(0);
  });
  it('写入后可读出，并向下取整（分数为整数）', () => {
    setBest(1234.9);
    expect(getBest()).toBe(1234);
  });
  it('刷新（重新读取）后仍保留，即 localStorage 持久（AC-6.4）', () => {
    setBest(500);
    expect(getBest()).toBe(500); // 同一存储再次读取
  });
  it('损坏/非数字数据回退为 0，不抛异常', () => {
    globalThis.localStorage.setItem('tr_best', 'not-a-number');
    expect(getBest()).toBe(0);
  });
});

describe('设置项默认与往返（NFR-5/NFR-6）', () => {
  beforeEach(() => mem.clear());

  it('无设置时返回安全默认：高画质 / 音效开 / 帧率隐藏', () => {
    expect(getSettings()).toEqual({ quality: 'high', soundOn: true, fpsOn: false });
  });
  it('saveSettings -> getSettings 往返一致', () => {
    saveSettings({ quality: 'low', soundOn: false, fpsOn: true });
    expect(getSettings()).toEqual({ quality: 'low', soundOn: false, fpsOn: true });
  });
  it('非法 quality 归一化为 high', () => {
    saveSettings({ quality: 'ultra', soundOn: true, fpsOn: false });
    expect(getSettings().quality).toBe('high');
  });
});

describe('隐私模式 / 存储不可用兜底（NFR-6/NFR-8）', () => {
  it('localStorage 抛错时读写不崩溃，最高分回退 0', () => {
    const original = globalThis.localStorage;
    globalThis.localStorage = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
    };
    expect(() => setBest(999)).not.toThrow();
    expect(getBest()).toBe(0);
    globalThis.localStorage = original;
  });
});

describe('帧率采样与加载耗时（NFR-7）', () => {
  it('FPS 采样滑动平均：累计 0.5s 后给出 fps', () => {
    const meter = createFpsMeter();
    let fps = meter.value;
    for (let i = 0; i < 30; i++) fps = meter.tick(1 / 60); // 30 帧 / 0.5s
    expect(fps).toBeCloseTo(60, 0);
    expect(meter.value).toBeCloseTo(60, 0);
  });
  it('不足半秒窗口时沿用上一次 fps，不抖动', () => {
    const meter = createFpsMeter();
    const v = meter.tick(1 / 60); // 仅一帧，未到 0.5s 窗口
    expect(v).toBe(60); // 初始值
  });
  it('加载耗时记录为非负数（markBoot -> markLoadDone）', () => {
    markBoot();
    const ms = markLoadDone();
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(getLoadMs()).toBe(ms);
  });
});
