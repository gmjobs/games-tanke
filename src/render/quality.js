/*
 * 性能自适应（NFR-5）：画质分级 high/low + FPS 动态降档（带迟滞），优先保帧率。
 */
export class QualityController {
  constructor(sceneMgr, worldView) {
    this.scene = sceneMgr;
    this.view = worldView;
    this.quality = 'high';
    this._lowFrames = 0;
    this._highFrames = 0;
    this.auto = true; // 自动降档；用户手动选择后仍可被自动降，但不会自动升过用户上限
    this._userCap = 'high';
  }

  apply(q) {
    this.quality = q;
    this.scene.setQuality(q);
    this.view.setQuality(q);
  }

  setUser(q) { this._userCap = q; this.auto = true; this.apply(q); }

  // 连续低帧 -> 降档；持续高帧 -> 回升（不超过用户上限）。迟滞避免抖动
  autoTune(fps) {
    if (!this.auto) return this.quality;
    if (fps < 45) { this._lowFrames++; this._highFrames = 0; }
    else if (fps > 56) { this._highFrames++; this._lowFrames = 0; }
    else { this._lowFrames = Math.max(0, this._lowFrames - 1); this._highFrames = 0; }

    if (this.quality === 'high' && this._lowFrames > 90) { // ~1.5s 持续低帧
      this.apply('low'); this._lowFrames = 0;
    } else if (this.quality === 'low' && this._userCap === 'high' && this._highFrames > 240) {
      this.apply('high'); this._highFrames = 0;
    }
    return this.quality;
  }
}
