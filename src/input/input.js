/*
 * 输入层（FR-3）：键盘与触摸滑动统一产出 Intent，去抖 + 优先级（AC-3.4/3.5）。
 * 键位：←→ 变道/转向，↑ 或 空格 跳跃，↓ 滑铲，P 暂停。
 * 触摸：四向滑动 → 对应操作。
 */
const SWIPE_MIN = 24; // 触摸判定为滑动的最小位移(px)

export class InputManager {
  constructor({ onPause, onAnyInput } = {}) {
    this.queue = [];
    this.onPause = onPause || (() => {});
    this.onAnyInput = onAnyInput || (() => {});
    this._touch = null;
    this._bind();
  }

  _push(type) {
    this.queue.push({ type, ts: performance.now() });
    this.onAnyInput();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return; // 去抖：按住不连发
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A': this._push('left'); break;
        case 'ArrowRight': case 'd': case 'D': this._push('right'); break;
        case 'ArrowUp': case 'w': case 'W': case ' ': case 'Spacebar':
          this._push('jump'); e.preventDefault(); break;
        case 'ArrowDown': case 's': case 'S': this._push('slide'); break;
        case 'p': case 'P': this.onPause(); break;
        default: return;
      }
    }, { passive: false });

    // 触摸四向滑动
    const start = (x, y) => { this._touch = { x, y, moved: false }; };
    const move = (x, y) => {
      const t = this._touch;
      if (!t || t.moved) return;
      const dx = x - t.x, dy = y - t.y;
      if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
      t.moved = true;
      if (Math.abs(dx) > Math.abs(dy)) this._push(dx > 0 ? 'right' : 'left');
      else this._push(dy > 0 ? 'slide' : 'jump');
    };
    const end = () => { this._touch = null; };

    const el = document;
    el.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]; start(t.clientX, t.clientY);
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      const t = e.changedTouches[0]; move(t.clientX, t.clientY);
    }, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
  }

  // 取出并解析本帧意图（优先级/去重）
  poll() {
    const raw = this.queue;
    this.queue = [];
    return this._resolve(raw);
  }

  // AC-3.5：jump/slide 互斥取最新；left/right 顺序保留（允许连续变道）
  _resolve(raw) {
    const out = [];
    let vertical = null; // 最后一次 jump/slide
    for (const it of raw) {
      if (it.type === 'jump' || it.type === 'slide') vertical = it;
      else out.push(it);
    }
    if (vertical) out.push(vertical);
    return out;
  }

  reset() { this.queue = []; this._touch = null; }
}
