/*
 * 可观测性（NFR-7）：FPS 采样、加载耗时、全局错误捕获与日志。
 */
const log = [];
function record(entry) {
  log.push({ t: performance.now(), ...entry });
  if (log.length > 200) log.shift();
}

let bootStart = performance.now();
let loadMs = 0;

export function markBoot() { bootStart = performance.now(); }
export function markLoadDone() {
  loadMs = Math.round(performance.now() - bootStart);
  record({ type: 'load', ms: loadMs });
  return loadMs;
}
export function getLoadMs() { return loadMs; }

// 帧率采样器：滑动平均，供 HUD 显示与画质自适应使用
export function createFpsMeter() {
  let frames = 0, acc = 0, fps = 60;
  return {
    tick(dt) {
      frames++; acc += dt;
      if (acc >= 0.5) { fps = frames / acc; frames = 0; acc = 0; }
      return fps;
    },
    get value() { return fps; },
  };
}

// 全局异常捕获（资源加载失败/运行时报错）
export function installErrorCapture(onError) {
  window.addEventListener('error', (e) => {
    record({ type: 'error', msg: e.message, src: e.filename });
    if (onError) onError(e);
  });
  window.addEventListener('unhandledrejection', (e) => {
    record({ type: 'rejection', reason: String(e.reason) });
    if (onError) onError(e);
  });
}

export function getLog() { return log.slice(); }
// 调试入口：window.__trace()
if (typeof window !== 'undefined') window.__trace = getLog;
