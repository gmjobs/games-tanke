/*
 * 游戏状态机（loading/menu/play/pause/over）。
 * 只管理相位与转移钩子，具体行为由 main 注入的回调实现。
 */
export const Phase = {
  LOADING: 'loading', MENU: 'menu', PLAY: 'play', PAUSE: 'pause', OVER: 'over',
};

export class GameStateMachine {
  constructor(hooks = {}) {
    this.phase = Phase.LOADING;
    this.hooks = hooks; // { onEnter(phase, prev, payload) }
  }

  _set(next, payload) {
    if (this.phase === next) return;
    const prev = this.phase;
    this.phase = next;
    if (this.hooks.onEnter) this.hooks.onEnter(next, prev, payload);
  }

  ready() { if (this.phase === Phase.LOADING) this._set(Phase.MENU); }
  start() { if (this.phase === Phase.MENU || this.phase === Phase.OVER) this._set(Phase.PLAY); }
  pause() { if (this.phase === Phase.PLAY) this._set(Phase.PAUSE); }
  resume() { if (this.phase === Phase.PAUSE) this._set(Phase.PLAY); }
  gameOver(reason) { if (this.phase === Phase.PLAY) this._set(Phase.OVER, reason); }
  restart() { this._set(Phase.PLAY, { restart: true }); }
  toMenu() { this._set(Phase.MENU); }

  is(p) { return this.phase === p; }
}
