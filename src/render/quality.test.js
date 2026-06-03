/*
 * 画质自适应单测（NFR-5）：分级 high/low + FPS 动态降档（带迟滞），优先保帧率。
 * 用假的 scene/view 注入，验证 apply 透传与 autoTune 的迟滞逻辑。
 */
import { describe, it, expect, vi } from 'vitest';
import { QualityController } from './quality.js';

function makeCtl() {
  const scene = { setQuality: vi.fn() };
  const view = { setQuality: vi.fn() };
  return { ctl: new QualityController(scene, view), scene, view };
}

describe('画质分级与透传（NFR-5）', () => {
  it('默认高画质', () => {
    const { ctl } = makeCtl();
    expect(ctl.quality).toBe('high');
  });
  it('apply 同步下发到 scene 与 view', () => {
    const { ctl, scene, view } = makeCtl();
    ctl.apply('low');
    expect(ctl.quality).toBe('low');
    expect(scene.setQuality).toHaveBeenCalledWith('low');
    expect(view.setQuality).toHaveBeenCalledWith('low');
  });
  it('setUser 设定用户画质上限并立即生效', () => {
    const { ctl, scene } = makeCtl();
    ctl.setUser('low');
    expect(ctl.quality).toBe('low');
    expect(ctl._userCap).toBe('low');
    expect(scene.setQuality).toHaveBeenLastCalledWith('low');
  });
});

describe('FPS 动态降档与迟滞（NFR-1/NFR-5）', () => {
  it('持续低帧（>90 帧 <45fps）自动降到 low', () => {
    const { ctl } = makeCtl();
    let q = 'high';
    for (let i = 0; i < 91; i++) q = ctl.autoTune(30);
    expect(q).toBe('low');
    expect(ctl.quality).toBe('low');
  });

  it('偶发低帧不抖动（短暂低于阈值不降档）', () => {
    const { ctl } = makeCtl();
    for (let i = 0; i < 30; i++) ctl.autoTune(30); // 远不足 90 帧
    expect(ctl.quality).toBe('high');
  });

  it('降档后持续高帧（>240 帧 >56fps）且用户允许高画质 -> 回升', () => {
    const { ctl } = makeCtl();
    for (let i = 0; i < 91; i++) ctl.autoTune(30);   // 先降到 low
    expect(ctl.quality).toBe('low');
    let q;
    for (let i = 0; i < 241; i++) q = ctl.autoTune(60); // 持续高帧
    expect(q).toBe('high');
  });

  it('用户上限为 low 时不会自动回升到 high', () => {
    const { ctl } = makeCtl();
    ctl.setUser('low');
    for (let i = 0; i < 400; i++) ctl.autoTune(60); // 即便帧率充裕
    expect(ctl.quality).toBe('low');
  });

  it('auto 关闭时 autoTune 不改变画质', () => {
    const { ctl } = makeCtl();
    ctl.auto = false;
    for (let i = 0; i < 200; i++) ctl.autoTune(5);
    expect(ctl.quality).toBe('high');
  });
});
