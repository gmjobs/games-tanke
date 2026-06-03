/*
 * UI 层（FR-1/6/7/8/9）：开始/加载、HUD、暂停、结算 Overlay 与画质/音效/帧率开关。
 * 直接复用已评审原型的 DOM/CSS，与 Canvas 分层，互不阻塞渲染。
 */
const $ = (id) => document.getElementById(id);

export class UI {
  constructor(hooks = {}) {
    this.h = hooks;
    this.el = {
      menu: $('menu'), pause: $('pause'), over: $('over'), warn: $('warn'),
      startBtn: $('startBtn'), loadfill: $('loadfill'), loadtxt: $('loadtxt'), loadWrap: $('loadWrap'),
      hDist: $('hDist'), hCoin: $('hCoin'), hScore: $('hScore'),
      pauseBtn: $('pauseBtn'), resumeBtn: $('resumeBtn'), quitBtn: $('quitBtn'),
      restartBtn: $('restartBtn'), homeBtn: $('homeBtn'),
      pDist: $('pDist'), pCoin: $('pCoin'),
      oScore: $('oScore'), oDist: $('oDist'), oCoin: $('oCoin'), oBest: $('oBest'),
      overReason: $('overReason'), newbest: $('newbest'),
      fps: $('fps'), flash: $('flash'),
      qSeg: $('qSeg'), sSeg: $('sSeg'), fSeg: $('fSeg'),
    };
    this._bind();
  }

  _bind() {
    const h = this.h;
    this.el.startBtn.addEventListener('click', () => { if (!this.el.startBtn.disabled) h.onStart && h.onStart(); });
    this.el.pauseBtn.addEventListener('click', () => h.onPause && h.onPause());
    this.el.resumeBtn.addEventListener('click', () => h.onResume && h.onResume());
    this.el.quitBtn.addEventListener('click', () => h.onQuit && h.onQuit());
    this.el.restartBtn.addEventListener('click', () => h.onRestart && h.onRestart());
    this.el.homeBtn.addEventListener('click', () => h.onHome && h.onHome());

    this._seg(this.el.qSeg, 'q', (v) => h.onSetQuality && h.onSetQuality(v));
    this._seg(this.el.sSeg, 's', (v) => h.onSetSound && h.onSetSound(v === 'on'));
    this._seg(this.el.fSeg, 'f', (v) => h.onSetFps && h.onSetFps(v === 'on'));
  }

  _seg(container, attr, cb) {
    if (!container) return;
    container.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        cb(btn.dataset[attr]);
      });
    });
  }

  // 同步开关初始态到存储设置
  initSettings(s) {
    const set = (seg, attr, val) => seg && seg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset[attr] === val);
    });
    set(this.el.qSeg, 'q', s.quality);
    set(this.el.sSeg, 's', s.soundOn ? 'on' : 'off');
    set(this.el.fSeg, 'f', s.fpsOn ? 'on' : 'off');
  }

  // ---- 加载 ----
  setProgress(pct) {
    const v = Math.round(pct);
    this.el.loadfill.style.width = v + '%';
    this.el.loadtxt.textContent = `资源加载中… ${v}%`;
  }
  enableStart() {
    this.el.loadtxt.textContent = '已就绪';
    this.el.startBtn.disabled = false;
    this.el.startBtn.textContent = '开始游戏';
  }

  // ---- Overlay 切换 ----
  _show(el) { el.classList.remove('hidden'); }
  _hide(el) { el.classList.add('hidden'); }
  showMenu() { this._show(this.el.menu); this._hide(this.el.pause); this._hide(this.el.over); }
  hideAll() { this._hide(this.el.menu); this._hide(this.el.pause); this._hide(this.el.over); }
  showPause(dist, coins) {
    this.el.pDist.textContent = Math.floor(dist);
    this.el.pCoin.textContent = coins;
    this._show(this.el.pause);
  }
  hidePause() { this._hide(this.el.pause); }
  showOver({ score, dist, coins, best, isNewBest, reason }) {
    this.el.oScore.textContent = score;
    this.el.oDist.textContent = Math.floor(dist);
    this.el.oCoin.textContent = coins;
    this.el.oBest.textContent = best;
    this.el.overReason.textContent = reason === 'offtrack' ? '冲出赛道' : '撞上障碍';
    this.el.newbest.classList.toggle('show', !!isNewBest);
    this._show(this.el.over);
  }

  // ---- HUD ----
  updateHUD(dist, coins, score) {
    this.el.hDist.innerHTML = `${Math.floor(dist)}<small> m</small>`;
    this.el.hCoin.textContent = coins;
    this.el.hScore.textContent = score;
  }
  setFps(v, on) {
    this.el.fps.classList.toggle('on', !!on);
    if (on) this.el.fps.textContent = `FPS ${Math.round(v)}`;
  }
  flash(text) {
    const f = this.el.flash;
    f.textContent = text;
    f.style.transition = 'none'; f.style.opacity = '1'; f.style.transform = 'translate(-50%,-50%) scale(1.1)';
    requestAnimationFrame(() => {
      f.style.transition = 'opacity .7s, transform .7s';
      f.style.opacity = '0'; f.style.transform = 'translate(-50%,-90%) scale(1)';
    });
  }
  showWarn() { this.el.warn.style.display = 'flex'; }
}
