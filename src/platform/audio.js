/*
 * WebAudio 合成音效（沿用原型方案）：无外部资源、零额外加载、跨端一致。
 */
let AC = null;
let enabled = true;

export function setSoundOn(on) { enabled = on; }
export function isSoundOn() { return enabled; }

// 用户手势后调用以解锁音频上下文（移动端策略）
export function unlock() {
  const ac = ctx();
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
}

function ctx() {
  if (!enabled) return null;
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { AC = null; }
  }
  return AC;
}

function beep(freq, dur, type = 'sine', vol = 0.18, slideTo = null) {
  const ac = ctx();
  if (!ac) return;
  try {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur + 0.02);
  } catch (e) { /* ignore */ }
}

// 关键动作音效绑定（AC-9.2 / TC-N.13）
export const sfx = {
  coin() { beep(880, 0.08, 'square', 0.12, 1320); },
  jump() { beep(420, 0.16, 'sine', 0.16, 760); },
  slide() { beep(300, 0.18, 'sawtooth', 0.10, 140); },
  turn() { beep(540, 0.12, 'triangle', 0.14, 720); },
  crash() { beep(180, 0.5, 'sawtooth', 0.25, 50); },
  start() { beep(520, 0.1, 'triangle', 0.14, 880); },
  best() { beep(660, 0.12, 'square', 0.16, 990); },
};
