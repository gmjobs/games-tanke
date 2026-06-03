/*
 * 入口与编排：能力探测 → 渐进加载 → 状态机 → 主循环。
 * 串联 boot/core/input/logic/render/platform/ui 各层（严格遵循技术方案分层）。
 */
import * as THREE from 'three';
import { GameStateMachine, Phase } from './core/state.js';
import { GameLoop } from './core/loop.js';
import { InputManager } from './input/input.js';
import { World } from './logic/world.js';
import { SceneManager } from './render/scene.js';
import { WorldView } from './render/pools.js';
import { QualityController } from './render/quality.js';
import { UI } from './ui/ui.js';
import * as Store from './platform/storage.js';
import * as Audio from './platform/audio.js';
import * as Tel from './platform/telemetry.js';

Tel.markBoot();
Tel.installErrorCapture();

const canvas = document.getElementById('game');

// ---------- 能力探测（NFR-4）----------
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch (e) { return false; }
}

const ui = new UI({});
if (!webglOK()) {
  ui.showWarn();
  throw new Error('WebGL unavailable');
}

// ---------- 设置 ----------
const settings = Store.getSettings();
Audio.setSoundOn(settings.soundOn);
ui.initSettings(settings);

// ---------- 构建系统 ----------
let scene, view, quality, world, input, loop, sm;
const fpsMeter = Tel.createFpsMeter();
let lastRender = performance.now();
let fpsOn = settings.fpsOn;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function boot() {
  ui.setProgress(5);
  await sleep(0);

  scene = new SceneManager(canvas);
  ui.setProgress(30);
  await sleep(0);

  view = new WorldView(scene.scene);
  quality = new QualityController(scene, view);
  quality.setUser(settings.quality);
  ui.setProgress(55);
  await sleep(0);

  world = new World();

  // 预热：放置初始路段并编译着色器，避免开局首帧卡顿（NFR-1/2）
  resizeAll();
  view.sync(world, 0, 0);
  scene.renderer.compile(scene.scene, scene.camera);
  ui.setProgress(80);
  await sleep(0);

  scene.render();
  ui.setProgress(95);
  await sleep(0);

  buildControls();
  loop.start();

  ui.setProgress(100);
  const ms = Tel.markLoadDone();
  console.log(`[telemetry] 加载完成 ${ms}ms`);
  ui.enableStart();
  sm.ready();
}

function buildControls() {
  sm = new GameStateMachine({
    onEnter(next, prev) {
      if (next === Phase.PLAY) ui.hideAll();
    },
  });

  input = new InputManager({
    onPause: () => { if (sm.is(Phase.PLAY)) doPause(); else if (sm.is(Phase.PAUSE)) doResume(); },
    onAnyInput: () => Audio.unlock(),
  });

  loop = new GameLoop({ update, render, onFrame });

  // UI 钩子
  ui.h.onStart = doStart;
  ui.h.onRestart = doStart;
  ui.h.onResume = doResume;
  ui.h.onPause = doPause;
  ui.h.onHome = doHome;
  ui.h.onQuit = doQuit;
  ui.h.onSetQuality = (q) => { quality.setUser(q); Store.saveSettings(read()); };
  ui.h.onSetSound = (on) => { Audio.setSoundOn(on); if (on) Audio.unlock(); Store.saveSettings(read()); };
  ui.h.onSetFps = (on) => { fpsOn = on; Store.saveSettings(read()); };

  // 失焦/切后台自动暂停（AC-8.3）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && sm.is(Phase.PLAY)) doPause();
  });
  window.addEventListener('blur', () => { if (sm.is(Phase.PLAY)) doPause(); });
  window.addEventListener('resize', resizeAll);
}

function read() {
  return { quality: quality._userCap, soundOn: Audio.isSoundOn(), fpsOn };
}

// ---------- 控制动作 ----------
function doStart() {
  Audio.unlock();
  world.reset();
  view.reset();
  input.reset();
  ui.hideAll();
  Audio.sfx.start();
  lastRender = performance.now();
  sm.start(); // MENU/OVER -> PLAY，完全复位（AC-7.3）
}
function doPause() {
  sm.pause();
  ui.showPause(world.distance, world.coins);
}
function doResume() {
  ui.hidePause();
  lastRender = performance.now();
  sm.resume();
}
function doHome() {
  sm.toMenu();
  ui.showMenu();
}
function doQuit() { endRun('quit'); }

function endRun(reason) {
  const prevBest = Store.getBest();
  const isNewBest = world.score > prevBest;
  if (isNewBest) { Store.setBest(world.score); Audio.sfx.best(); }
  if (reason === 'collision' || reason === 'offtrack') {
    Audio.sfx.crash();
    view.crash(view.runner.group.position);
    scene.shake(1.4);
  }
  sm.gameOver(reason);
  ui.showOver({
    score: world.score, dist: world.distance, coins: world.coins,
    best: Store.getBest(), isNewBest, reason,
  });
}

// ---------- 主循环回调 ----------
function update(dt) {
  if (!sm.is(Phase.PLAY)) return;
  const events = world.update(dt, input.poll());
  for (const e of events) handleEvent(e);
}

function handleEvent(e) {
  switch (e.type) {
    case 'jump': Audio.sfx.jump(); break;
    case 'slide': Audio.sfx.slide(); break;
    case 'coin': Audio.sfx.coin(); break;
    case 'turnPrompt': ui.flash(e.value < 0 ? '← 左转' : '右转 →'); break;
    case 'turn': Audio.sfx.turn(); ui.flash('漂亮！'); break;
    case 'over': endRun(e.value); break;
  }
}

function render() {
  const now = performance.now();
  let dt = (now - lastRender) / 1000;
  lastRender = now;
  if (dt > 0.05) dt = 0.05;
  const animDt = sm.is(Phase.PLAY) || sm.is(Phase.MENU) ? dt : 0;

  const info = view.sync(world, animDt, now / 1000);
  scene.follow(info.pos, info.fwd, 1.4, dt);
  scene.render();

  if (sm.is(Phase.PLAY)) ui.updateHUD(world.distance, world.coins, world.score);
}

function onFrame(dt) {
  const fps = fpsMeter.tick(dt);
  ui.setFps(fps, fpsOn);
  if (sm && sm.is(Phase.PLAY)) quality.autoTune(fps);
}

function resizeAll() {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (scene) scene.resize(w, h, dpr);
}

boot().catch((err) => {
  console.error(err);
  ui.showWarn();
});
