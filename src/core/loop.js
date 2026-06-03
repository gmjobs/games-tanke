/*
 * 主循环：固定步长 update + 渲染插值（rAF）。
 * 逻辑与帧率解耦，保证不同设备物理一致、输入响应稳定（NFR-1/NFR-3）。
 */
import { FIXED_DT, MAX_FRAME } from '../config.js';

export class GameLoop {
  constructor({ update, render, onFrame }) {
    this.FIXED_DT = FIXED_DT;
    this._update = update;   // update(dt) 推进逻辑
    this._render = render;   // render(alpha) 渲染插值
    this._onFrame = onFrame; // onFrame(frameDt) 每帧回调（FPS/HUD）
    this._acc = 0;
    this._last = 0;
    this._raf = 0;
    this._running = false;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    this._acc = 0;
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _tick(now) {
    if (!this._running) return;
    let dt = (now - this._last) / 1000;
    this._last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME; // 卡顿/切后台后限幅，避免大跨步穿模

    this._acc += dt;
    let steps = 0;
    while (this._acc >= this.FIXED_DT && steps < 8) {
      this._update(this.FIXED_DT);
      this._acc -= this.FIXED_DT;
      steps++;
    }
    const alpha = this._acc / this.FIXED_DT; // 渲染插值因子
    this._render(alpha);
    if (this._onFrame) this._onFrame(dt);

    this._raf = requestAnimationFrame(this._tick);
  }
}
