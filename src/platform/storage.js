/*
 * 持久化（NFR-6）：仅最高分与设置项，存于 localStorage，无任何个人身份信息。
 */
const KEY_BEST = 'tr_best';
const KEY_SETTINGS = 'tr_settings';

function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 隐私模式等忽略 */ } }

export function getBest() {
  return parseInt(safeGet(KEY_BEST) || '0', 10) || 0;
}
export function setBest(v) {
  safeSet(KEY_BEST, String(Math.floor(v)));
}
export function getSettings() {
  let s = {};
  try { s = JSON.parse(safeGet(KEY_SETTINGS) || '{}') || {}; } catch (e) { s = {}; }
  return {
    quality: s.quality === 'low' ? 'low' : 'high',
    soundOn: s.soundOn !== false,
    fpsOn: s.fpsOn === true,
  };
}
export function saveSettings(s) {
  safeSet(KEY_SETTINGS, JSON.stringify({
    quality: s.quality, soundOn: s.soundOn, fpsOn: s.fpsOn,
  }));
}
