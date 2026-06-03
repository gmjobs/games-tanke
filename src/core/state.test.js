/*
 * 状态机单测（FR-1/FR-7/FR-8）。GameStateMachine 纯逻辑、无浏览器依赖。
 * 覆盖：相位流转、即点即玩门禁、暂停/恢复、失败、重开、非法转移忽略。
 */
import { describe, it, expect, vi } from 'vitest';
import { GameStateMachine, Phase } from './state.js';

describe('GameStateMachine 相位流转（FR-1/7/8）', () => {
  it('初始相位为 loading（AC-1.3：资源就绪前不可开始）', () => {
    const sm = new GameStateMachine();
    expect(sm.phase).toBe(Phase.LOADING);
    expect(sm.is(Phase.LOADING)).toBe(true);
  });

  it('loading 态下 start 无效，必须先 ready 进入 menu（AC-1.2/1.3）', () => {
    const sm = new GameStateMachine();
    sm.start();                          // 资源未就绪，禁止开始
    expect(sm.phase).toBe(Phase.LOADING);
    sm.ready();
    expect(sm.phase).toBe(Phase.MENU);
    sm.start();                          // 就绪后方可开始
    expect(sm.phase).toBe(Phase.PLAY);
  });

  it('暂停 / 恢复闭环（AC-8.1/8.2）', () => {
    const sm = new GameStateMachine();
    sm.ready(); sm.start();
    sm.pause();
    expect(sm.phase).toBe(Phase.PAUSE);
    sm.resume();
    expect(sm.phase).toBe(Phase.PLAY);
  });

  it('暂停态下不响应 pause/gameOver 等非法转移（AC-8.6）', () => {
    const sm = new GameStateMachine();
    sm.ready(); sm.start(); sm.pause();
    sm.pause();                          // 已是 pause，无变化
    expect(sm.phase).toBe(Phase.PAUSE);
    sm.gameOver('collision');            // 仅 PLAY 可触发 over
    expect(sm.phase).toBe(Phase.PAUSE);
  });

  it('失败进入 over 并携带原因（FR-5/AC-7.1）', () => {
    const reasons = [];
    const sm = new GameStateMachine({ onEnter: (next, prev, payload) => {
      if (next === Phase.OVER) reasons.push(payload);
    } });
    sm.ready(); sm.start();
    sm.gameOver('offtrack');
    expect(sm.phase).toBe(Phase.OVER);
    expect(reasons).toEqual(['offtrack']);
  });

  it('over 态可直接 start 重开（AC-7.2）', () => {
    const sm = new GameStateMachine();
    sm.ready(); sm.start(); sm.gameOver('collision');
    sm.start();
    expect(sm.phase).toBe(Phase.PLAY);
  });

  it('restart 进入 play 并带 restart 标记（AC-7.2/7.3）', () => {
    let payload = null;
    const sm = new GameStateMachine({ onEnter: (next, prev, p) => { if (next === Phase.PLAY) payload = p; } });
    sm.ready(); sm.start(); sm.gameOver('collision');
    sm.restart();
    expect(sm.phase).toBe(Phase.PLAY);
    expect(payload).toEqual({ restart: true });
  });

  it('toMenu 可从 over 返回首页（AC-7.3）', () => {
    const sm = new GameStateMachine();
    sm.ready(); sm.start(); sm.gameOver('collision');
    sm.toMenu();
    expect(sm.phase).toBe(Phase.MENU);
  });

  it('onEnter 钩子收到 (next, prev, payload) 且相同相位不触发', () => {
    const onEnter = vi.fn();
    const sm = new GameStateMachine({ onEnter });
    sm.ready();                          // loading -> menu
    expect(onEnter).toHaveBeenCalledWith(Phase.MENU, Phase.LOADING, undefined);
    onEnter.mockClear();
    sm.ready();                          // 已是 menu，不再触发
    expect(onEnter).not.toHaveBeenCalled();
  });
});
