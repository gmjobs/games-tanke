/*
 * 输入意图解析单测（AC-3.4/AC-3.5）：键盘/触摸统一产出 Intent，去抖 + 优先级。
 * 用最小 window/document 桩满足构造时的事件绑定，重点验证 _resolve / poll 的去抖优先级。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// 构造前装好最小 DOM 桩（InputManager 在构造函数里绑定 window/document 事件）
globalThis.window = globalThis.window || { addEventListener: vi.fn() };
globalThis.document = globalThis.document || { addEventListener: vi.fn() };

const { InputManager } = await import('./input.js');

describe('意图优先级与去抖（AC-3.5）', () => {
  let im;
  beforeEach(() => { im = new InputManager(); });

  it('jump/slide 互斥，取最新的竖向意图', () => {
    const out = im._resolve([
      { type: 'jump', ts: 1 },
      { type: 'slide', ts: 2 },
      { type: 'jump', ts: 3 },
    ]);
    const verticals = out.filter((i) => i.type === 'jump' || i.type === 'slide');
    expect(verticals).toHaveLength(1);
    expect(verticals[0].ts).toBe(3); // 最新者胜出（jump）
  });

  it('同帧同时上滑+下滑 -> 仅保留最后一个，绝不同时跳+铲', () => {
    const out = im._resolve([{ type: 'jump', ts: 1 }, { type: 'slide', ts: 2 }]);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('slide');
  });

  it('左右变道顺序保留（允许连续变道），竖向意图置于末尾', () => {
    const out = im._resolve([
      { type: 'left', ts: 1 },
      { type: 'jump', ts: 2 },
      { type: 'right', ts: 3 },
      { type: 'slide', ts: 4 },
    ]);
    expect(out.map((i) => i.type)).toEqual(['left', 'right', 'slide']);
  });

  it('无竖向意图时原样保留左右序列', () => {
    const out = im._resolve([
      { type: 'left', ts: 1 }, { type: 'right', ts: 2 }, { type: 'left', ts: 3 },
    ]);
    expect(out.map((i) => i.type)).toEqual(['left', 'right', 'left']);
  });
});

describe('队列收集与 poll（AC-3.4）', () => {
  it('_push 入队后 poll 取出并清空，且触发 onAnyInput', () => {
    const onAnyInput = vi.fn();
    const im = new InputManager({ onAnyInput });
    im._push('left');
    im._push('jump');
    expect(onAnyInput).toHaveBeenCalledTimes(2);
    const out = im.poll();
    expect(out.map((i) => i.type)).toEqual(['left', 'jump']);
    expect(im.poll()).toEqual([]); // 已清空
  });

  it('reset 清空待处理队列', () => {
    const im = new InputManager();
    im._push('right');
    im.reset();
    expect(im.poll()).toEqual([]);
  });
});
