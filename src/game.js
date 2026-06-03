/*
 * 坦克大战豪华版 —— 引擎层
 * 固定时间步长主循环 + FSM + 渲染 + 输入 + 音频 + 持久化。
 * 所有「纯规则」（地图/碰撞/配置）一律取自 TankLogic（src/logic.js），不重复实现。
 */
(function () {
  "use strict";

  var L = window.TankLogic;
  var TILE = L.TILE, COLS = L.COLS, ROWS = L.ROWS, W = L.W, H = L.H, TS = L.TS;
  var MAXLV = L.MAXLV, MAX_ENEMY_SCREEN = L.MAX_ENEMY_SCREEN, FIXED_DT = L.FIXED_DT;
  var EMPTY = L.EMPTY, BRICK = L.BRICK, STEEL = L.STEEL, GRASS = L.GRASS, WATER = L.WATER;
  var ENEMY_TYPES = L.ENEMY_TYPES, ITEM_TYPES = L.ITEM_TYPES, ITEM_KEYS = L.ITEM_KEYS;
  var FORT = L.FORT;

  var cv = document.getElementById("cv");
  var ctx = cv.getContext("2d");
  var $ = function (id) { return document.getElementById(id); };

  /* ============ 持久化（localStorage 单键 JSON）============ */
  var KEY = "tankDeluxe.v1";
  var store = { high: 0, highLv: 1, save: null, bgm: false, sfx: true, touch: false, mode: 1 };
  try {
    var s = JSON.parse(localStorage.getItem(KEY));
    if (s) store = Object.assign(store, s);
  } catch (e) { /* 隐私模式/解析失败：降级为内存态，不报错（AC-12.3）*/ }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { } }

  /* ============ 音频（WebAudio 程序化合成）============ */
  var actx = null;
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
    if (actx && actx.state === "suspended") { try { actx.resume(); } catch (e) { } }
    return actx;
  }
  function sfx(type) {
    if (!store.sfx) return;
    var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.connect(g); g.connect(a.destination);
    var t = a.currentTime, f = 440, d = 0.12, wave = "square";
    if (type === "shoot") { f = 620; d = 0.07; }
    else if (type === "boom") { f = 120; d = 0.25; wave = "sawtooth"; }
    else if (type === "pick") { f = 880; d = 0.16; wave = "sine"; }
    else if (type === "level") { f = 520; d = 0.4; }
    else if (type === "over") { f = 180; d = 0.6; wave = "sawtooth"; }
    else if (type === "hit") { f = 300; d = 0.08; }
    o.type = wave; o.frequency.setValueAtTime(f, t);
    if (type === "boom" || type === "over") o.frequency.exponentialRampToValueAtTime(60, t + d);
    if (type === "level") o.frequency.exponentialRampToValueAtTime(1040, t + d);
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.start(t); o.stop(t + d);
  }
  var bgmTimer = null, bgmStep = 0;
  var BGM_NOTES = [330, 392, 494, 392, 440, 330, 294, 392];
  function bgmOn() {
    if (bgmTimer || !store.bgm) return;
    var a = audio(); if (!a) return;
    bgmTimer = setInterval(function () {
      if (!store.bgm) { bgmOff(); return; }
      var f = BGM_NOTES[bgmStep++ % BGM_NOTES.length];
      var o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.type = "triangle"; o.frequency.value = f;
      var t = a.currentTime;
      g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.start(t); o.stop(t + 0.32);
    }, 300);
  }
  function bgmOff() { if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; } }

  /* ============ 运行时状态 ============ */
  var state = "menu";              // menu / playing / paused / clear / over
  var mode = store.mode || 1;      // 1 单人 / 2 双人
  var map = [], base = null;
  var players = [], enemies = [], bullets = [], powerups = [], booms = [];
  var level = 1, toSpawn = 0, killedThisLevel = null, spawnTimer = 0;
  var freezeTimer = 0, fortifyTimer = 0;
  var keys = {}, last = 0, acc = 0, animId = null, resumeFlag = false;

  /* ============ 实体工厂 ============ */
  function makeTank(x, y, opt) {
    return Object.assign({
      x: x, y: y, w: TS, h: TS, dir: "up", speed: 60, cool: 0,
      isPlayer: false, hp: 1, type: "normal", maxBullets: 1, power: false,
      fireTimer: 0, shield: 0, shieldNotify: false, flash: false,
      chTimer: 0, shTimer: 0, score: 0, lives: 3, alive: true, id: 0, color: "#fff"
    }, opt);
  }

  function newGame() {
    level = (resumeFlag && store.save) ? store.save.level : 1;
    var keep = (resumeFlag && store.save) ? store.save.scores : null;
    startLevel(level, keep);
    resumeFlag = false;
  }

  function startLevel(n, keepScores) {
    level = n;
    var built = L.buildMap(n);
    map = built.map; base = built.base;
    bullets = []; powerups = []; booms = []; enemies = [];
    freezeTimer = 0; fortifyTimer = 0; spawnTimer = 0;
    var cfg = L.levelConfig(n);
    toSpawn = cfg.total;
    killedThisLevel = { normal: 0, fast: 0, armor: 0, score: 0 };
    players = [];
    players.push(makeTank(7 * TILE, 24 * TILE, { isPlayer: true, id: 1, dir: "up", speed: 96, color: "#ffd24a" }));
    if (mode === 2) {
      players.push(makeTank(16 * TILE, 24 * TILE, { isPlayer: true, id: 2, dir: "up", speed: 96, color: "#4fc3f7" }));
    }
    if (keepScores) players.forEach(function (p, i) { if (keepScores[i] != null) p.score = keepScores[i]; });
    players.forEach(function (p) { p.shield = 1.5; });   // 初始 1.5s 保护，不弹到期提示
    spawnEnemy(); spawnEnemy();
    setState("playing");
    updateHUD();
  }

  function spawnEnemy() {
    if (toSpawn <= 0 || enemies.length >= MAX_ENEMY_SCREEN) return;
    var cfg = L.levelConfig(level);
    var type = L.pickEnemyType(cfg, Math.random());
    var T = ENEMY_TYPES[type];
    var spots = [0, 12, 24];
    var c = spots[Math.floor(Math.random() * spots.length)];
    var x = c * TILE, y = 0;
    for (var i = 0; i < enemies.length; i++) {            // 出生点占用检测
      if (Math.abs(enemies[i].x - x) < TS && Math.abs(enemies[i].y - y) < TS) return;
    }
    var flash = Math.random() < 0.3;                      // 闪烁敌人 → 击毁掉道具（AC-4.4）
    enemies.push(makeTank(x, y, {
      isPlayer: false, dir: "down", type: type, hp: T.hp, speed: T.speed,
      color: T.color, score: T.score, flash: flash,
      chTimer: Math.random() * 1.2, shTimer: 1 + Math.random() * 1.5
    }));
    toSpawn--;
  }

  /* 世界视图（提供给逻辑层做碰撞判定） */
  function world() { return { map: map, base: base, tanks: enemies.concat(players) }; }

  /* ============ 移动 / 射击 ============ */
  function moveTank(t, dir, dt) {
    if (dir !== t.dir) {                                  // 转向对齐到格，便于穿行
      if (dir === "up" || dir === "down") t.x = Math.round(t.x / TILE) * TILE;
      else t.y = Math.round(t.y / TILE) * TILE;
      t.dir = dir;
    }
    var d = t.speed * dt, nx = t.x, ny = t.y;
    if (dir === "up") ny -= d; else if (dir === "down") ny += d;
    else if (dir === "left") nx -= d; else nx += d;
    if (!L.tankBlocked(world(), t, nx, ny)) { t.x = nx; t.y = ny; }
  }

  function fire(t) {
    if (t.cool > 0) return;
    var mine = 0;
    for (var i = 0; i < bullets.length; i++) if (bullets[i].owner === t) mine++;
    if (mine >= t.maxBullets) return;
    t.cool = 0.35;
    var cx = t.x + TS / 2, cy = t.y + TS / 2, bx = cx, by = cy;
    if (t.dir === "up") by = t.y; else if (t.dir === "down") by = t.y + TS;
    else if (t.dir === "left") bx = t.x; else bx = t.x + TS;
    bullets.push({ x: bx - 3, y: by - 3, w: 6, h: 6, dir: t.dir, owner: t, isPlayer: t.isPlayer, power: t.power, speed: 300 });
    if (t.isPlayer) sfx("shoot");
  }

  /* ============ 逻辑步进（固定 dt）============ */
  function step(dt) {
    // —— 玩家输入与限时效果计时 ——
    players.forEach(function (p) {
      if (!p.alive) return;
      p.cool = Math.max(0, p.cool - dt);
      if (p.shield > 0) {
        p.shield -= dt;
        if (p.shield <= 0) { p.shield = 0; if (p.shieldNotify) { p.shieldNotify = false; toast("护盾结束"); } }
      }
      if (p.fireTimer > 0) {
        p.fireTimer -= dt;
        if (p.fireTimer <= 0) { p.fireTimer = 0; p.power = false; p.maxBullets = 1; toast("火力结束"); }
      }
      var dir = null, shoot = false;
      if (p.id === 1) {
        if (keys["ArrowUp"]) dir = "up"; else if (keys["ArrowDown"]) dir = "down";
        else if (keys["ArrowLeft"]) dir = "left"; else if (keys["ArrowRight"]) dir = "right";
        shoot = keys[" "] || keys["spacebar"];
        if (touchDir) dir = touchDir;
        if (touchFire) shoot = true;
      } else {
        if (keys["w"]) dir = "up"; else if (keys["s"]) dir = "down";
        else if (keys["a"]) dir = "left"; else if (keys["d"]) dir = "right";
        shoot = keys["f"];
      }
      if (dir) moveTank(p, dir, dt);
      if (shoot) fire(p);
    });

    // —— 定身 / 基地加固 限时回滚 ——
    if (freezeTimer > 0) { freezeTimer -= dt; if (freezeTimer <= 0) { freezeTimer = 0; toast("敌人解除定身"); } }
    if (fortifyTimer > 0) {
      fortifyTimer -= dt;
      if (fortifyTimer <= 0) {
        fortifyTimer = 0;
        FORT.forEach(function (cell) { if (map[cell[1]][cell[0]] === STEEL) map[cell[1]][cell[0]] = BRICK; });
        toast("基地加固结束");
      }
    }

    // —— 敌人 AI（移动/转向/射击/趋向基地）——
    enemies.forEach(function (e) {
      if (!e.alive) return;
      e.cool = Math.max(0, e.cool - dt);
      if (freezeTimer > 0) return;                        // 定身期间静止（AC-6.1）
      e.chTimer -= dt; e.shTimer -= dt;
      var aheadX = e.x + (e.dir === "left" ? -1 : e.dir === "right" ? 1 : 0);
      var aheadY = e.y + (e.dir === "up" ? -1 : e.dir === "down" ? 1 : 0);
      if (e.chTimer <= 0 || L.tankBlocked(world(), e, aheadX, aheadY)) {
        e.chTimer = 0.6 + Math.random() * 1.4;
        var r = Math.random();
        e.dir = r < 0.5 ? "down"
          : r < 0.65 ? (e.x > base.c * TILE ? "left" : "right")     // 趋向基地横向靠拢
            : ["up", "left", "right", "down"][Math.floor(Math.random() * 4)];
      }
      moveTank(e, e.dir, dt);
      if (e.shTimer <= 0) { e.shTimer = 1 + Math.random() * 2; fire(e); }
    });

    // —— 子弹 ——
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i], d = b.speed * dt;
      if (b.dir === "up") b.y -= d; else if (b.dir === "down") b.y += d;
      else if (b.dir === "left") b.x -= d; else b.x += d;
      var dead = false;
      if (b.x < 0 || b.y < 0 || b.x > W || b.y > H) dead = true;
      // 地形
      if (!dead) {
        var c = Math.floor((b.x + 3) / TILE), r = Math.floor((b.y + 3) / TILE);
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
          var res = L.bulletTile(map[r][c], b.power);
          if (res.stop) {
            if (res.destroy) {
              map[r][c] = EMPTY;
              if (b.power && map[r][c - 1] !== undefined) {           // 破钢子弹波及相邻砖墙
                [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]].forEach(function (p) {
                  if (map[p[1]] && map[p[1]][p[0]] === BRICK) map[p[1]][p[0]] = EMPTY;
                });
              }
            }
            dead = true; sfx("hit");
          }
        }
      }
      // 基地被击中 → 立即失败（AC-5.3）
      if (!dead && base.alive) {
        var bx = base.c * TILE, by = base.r * TILE;
        if (b.x < bx + TS && b.x + 6 > bx && b.y < by + TS && b.y + 6 > by) {
          base.alive = false; boom(bx + TILE, by + TILE);
          bullets.splice(i, 1); gameOver("基地被摧毁"); return;
        }
      }
      // 子弹互相抵消（AC-5.2）
      if (!dead) {
        for (var j = bullets.length - 1; j >= 0; j--) {
          var o = bullets[j];
          if (o === b) continue;
          if (o.isPlayer !== b.isPlayer && L.aabb(b, o)) { bullets.splice(j, 1); if (j < i) i--; dead = true; break; }
        }
      }
      // 命中坦克
      if (!dead) {
        if (b.isPlayer) {
          for (var ei = 0; ei < enemies.length; ei++) {
            if (enemies[ei].alive && L.aabb(b, enemies[ei])) { dead = true; hitEnemy(enemies[ei], b); break; }
          }
        } else {
          for (var pi = 0; pi < players.length; pi++) {
            if (players[pi].alive && L.aabb(b, players[pi])) { dead = true; hitPlayer(players[pi]); break; }
          }
        }
      }
      if (dead) bullets.splice(i, 1);
    }

    // —— 道具计时 / 拾取 ——
    for (var pu = powerups.length - 1; pu >= 0; pu--) {
      var it = powerups[pu]; it.t -= dt;
      if (it.t <= 0) { powerups.splice(pu, 1); continue; }
      for (var k = 0; k < players.length; k++) {
        if (players[k].alive && L.aabb(it, players[k])) { applyPower(it.type, players[k]); powerups.splice(pu, 1); break; }
      }
    }

    // —— 爆炸动画 ——
    for (var bi = booms.length - 1; bi >= 0; bi--) { booms[bi].t += dt; if (booms[bi].t > 0.45) booms.splice(bi, 1); }

    // —— 持续刷怪 ——
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnTimer = 2.2; spawnEnemy(); }

    // —— 胜负 / 过关检测 ——
    if (!players.some(function (p) { return p.alive; })) { gameOver("全部玩家阵亡"); return; }
    if (toSpawn <= 0 && enemies.length === 0) { levelClear(); }
  }

  function boom(x, y) { booms.push({ x: x, y: y, t: 0 }); sfx("boom"); }

  function hitEnemy(e, b) {
    e.hp--;
    if (e.hp <= 0) {
      e.alive = false; boom(e.x + TS / 2, e.y + TS / 2);
      var owner = b.owner, sc = e.score;
      if (owner && owner.isPlayer) owner.score += sc;
      killedThisLevel[e.type]++; killedThisLevel.score += sc;
      if (e.flash) dropPower();
      enemies = enemies.filter(function (x) { return x !== e; });
      updateHUD();
    } else sfx("hit");
  }

  function hitPlayer(p) {
    if (p.shield > 0) return;                              // 护盾期间无敌
    p.lives--; boom(p.x + TS / 2, p.y + TS / 2);
    if (p.lives < 0) { p.alive = false; sfx("over"); }
    else {                                                 // 重生
      p.x = (p.id === 1 ? 7 : 16) * TILE; p.y = 24 * TILE;
      p.dir = "up"; p.power = false; p.maxBullets = 1; p.fireTimer = 0;
      p.shield = 2; p.shieldNotify = false; sfx("boom");
    }
    updateHUD();
  }

  function dropPower() {
    var type = ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)];
    var x = (2 + Math.floor(Math.random() * 22)) * TILE;
    var y = (3 + Math.floor(Math.random() * 18)) * TILE;
    powerups.push({ x: x, y: y, w: TS, h: TS, type: type, t: 12, blink: 0 });
  }

  function applyPower(type, p) {
    sfx("pick");
    var cfg = ITEM_TYPES[type];
    if (type === "fire") { p.power = true; p.maxBullets = 2; p.fireTimer = cfg.duration; toast("火力增强：可破钢墙 " + cfg.duration + "s"); }
    else if (type === "shield") { p.shield = cfg.duration; p.shieldNotify = true; toast("护盾：" + cfg.duration + "s 无敌"); }
    else if (type === "bomb") {
      enemies.forEach(function (e) {
        e.alive = false; boom(e.x + TS / 2, e.y + TS / 2);
        p.score += e.score; killedThisLevel[e.type]++; killedThisLevel.score += e.score;
      });
      enemies = []; toast("炸弹：清除同屏敌人"); updateHUD();
    }
    else if (type === "life") { p.lives++; toast("加命 +1"); }
    else if (type === "freeze") { freezeTimer = cfg.duration; toast("定身：敌人静止 " + cfg.duration + "s"); }
    else if (type === "fortify") {
      FORT.forEach(function (cell) { if (map[cell[1]][cell[0]] === BRICK || map[cell[1]][cell[0]] === EMPTY) map[cell[1]][cell[0]] = STEEL; });
      fortifyTimer = cfg.duration; toast("基地加固：" + cfg.duration + "s");
    }
    updateHUD();
  }

  /* ============ 渲染 ============ */
  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a0c11"; ctx.fillRect(0, 0, W, H);
    // 地形（草丛最后覆盖）
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var t = map[r][c]; if (t === EMPTY || t === GRASS) continue;
      var x = c * TILE, y = r * TILE;
      if (t === BRICK) {
        ctx.fillStyle = "#8a4a2a"; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#6b3620";
        for (var ii = 0; ii < 2; ii++) for (var jj = 0; jj < 2; jj++) ctx.fillRect(x + jj * 10 + 1, y + ii * 10 + 1, 8, 8);
      } else if (t === STEEL) {
        ctx.fillStyle = "#9aa3b2"; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#c9d2e0"; ctx.fillRect(x + 2, y + 2, 7, 7); ctx.fillRect(x + 11, y + 11, 7, 7);
      } else if (t === WATER) {
        ctx.fillStyle = "#1b66a6"; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#2f86cf"; ctx.fillRect(x + 2, y + 8, 16, 3);
      }
    }
    // 基地
    if (base) {
      var bx = base.c * TILE, by = base.r * TILE;
      ctx.fillStyle = base.alive ? "#caa84a" : "#444"; ctx.fillRect(bx + 4, by + 4, TS - 8, TS - 8);
      ctx.fillStyle = base.alive ? "#ffe08a" : "#222";
      ctx.font = "bold 22px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(base.alive ? "★" : "✖", bx + TS / 2, by + TS / 2 + 1);
    }
    // 道具（闪烁）
    powerups.forEach(function (it) {
      it.blink = (it.blink || 0) + 1;
      if (Math.floor(it.blink / 8) % 2 === 0) return;
      var cfg = ITEM_TYPES[it.type];
      ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(it.x + 3, it.y + 3, TS - 6, TS - 6);
      ctx.strokeStyle = cfg.color; ctx.lineWidth = 2; ctx.strokeRect(it.x + 3, it.y + 3, TS - 6, TS - 6);
      ctx.fillStyle = cfg.color; ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(cfg.glyph, it.x + TS / 2, it.y + TS / 2 + 1);
    });
    // 坦克
    enemies.forEach(function (e) {
      var col = (e.flash && Math.floor(performance.now() / 200) % 2) ? "#ff7070" : e.color;
      drawTank(e, col);
    });
    players.forEach(function (p) { if (p.alive) drawTank(p, p.color); });
    // 子弹
    bullets.forEach(function (b) {
      ctx.fillStyle = b.power ? "#ff8a3a" : (b.isPlayer ? "#fff" : "#ffd0d0");
      ctx.fillRect(b.x, b.y, 6, 6);
    });
    // 草丛覆盖（隐藏坦克 AC-2.2）
    for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) {
      if (map[r2][c2] === GRASS) {
        ctx.fillStyle = "rgba(40,150,50,.85)"; ctx.fillRect(c2 * TILE, r2 * TILE, TILE, TILE);
        ctx.fillStyle = "#2f7a35"; ctx.fillRect(c2 * TILE + 3, r2 * TILE + 3, 5, 5); ctx.fillRect(c2 * TILE + 11, r2 * TILE + 10, 5, 5);
      }
    }
    // 爆炸
    booms.forEach(function (b) {
      var p = b.t / 0.45, rad = 6 + p * 22;
      ctx.beginPath(); ctx.arc(b.x, b.y, rad, 0, 7);
      ctx.fillStyle = "rgba(255," + Math.floor(180 * (1 - p)) + ",40," + (1 - p) + ")"; ctx.fill();
    });
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  }

  function drawTank(t, color) {
    var x = t.x, y = t.y;
    ctx.fillStyle = color; ctx.fillRect(x + 4, y + 4, TS - 8, TS - 8);
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(x + 13, y + 13, TS - 26, TS - 26);
    ctx.fillStyle = color;
    var cx = x + TS / 2, cy = y + TS / 2;
    if (t.dir === "up") ctx.fillRect(cx - 3, y, 6, TS / 2);
    else if (t.dir === "down") ctx.fillRect(cx - 3, cy, 6, TS / 2);
    else if (t.dir === "left") ctx.fillRect(x, cy - 3, TS / 2, 6);
    else ctx.fillRect(cx, cy - 3, TS / 2, 6);
    ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(x + 2, y + 2, 3, TS - 4); ctx.fillRect(x + TS - 5, y + 2, 3, TS - 4);
    if (t.shield > 0) {
      ctx.strokeStyle = Math.floor(performance.now() / 120) % 2 ? "#7fe0ff" : "#fff";
      ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, TS - 2, TS - 2);
    }
  }

  /* ============ HUD / 屏幕 ============ */
  function fmtSec(s) { return Math.ceil(s) + "s"; }
  function activeEffects() {
    var out = [];
    if (players[0] && players[0].fireTimer > 0) out.push("火" + fmtSec(players[0].fireTimer));
    if (players[0] && players[0].shield > 0 && players[0].shieldNotify) out.push("盾" + fmtSec(players[0].shield));
    if (freezeTimer > 0) out.push("停" + fmtSec(freezeTimer));
    if (fortifyTimer > 0) out.push("固" + fmtSec(fortifyTimer));
    return out;
  }
  function updateHUD() {
    $("hud").style.display = (state === "playing" || state === "paused") ? "flex" : "none";
    if (players[0]) { $("hP1").textContent = "♥" + Math.max(0, players[0].lives); $("hS1").textContent = players[0].score + "分"; }
    $("chipP2").style.display = mode === 2 ? "flex" : "none";
    if (mode === 2 && players[1]) { $("hP2").textContent = "♥" + Math.max(0, players[1].lives); $("hS2").textContent = players[1].score + "分"; }
    $("hLv").textContent = level;
    $("hEn").textContent = toSpawn + enemies.length;
    $("hHi").textContent = store.high;
    var eff = activeEffects();
    $("chipEff").style.display = eff.length ? "flex" : "none";
    $("hEff").textContent = eff.join(" ");
  }

  var overlays = ["ovMenu", "ovMode", "ovSet", "ovHigh", "ovHelp", "ovPause", "ovClear", "ovOver"];
  function showOnly(id) {
    overlays.forEach(function (o) { $(o).classList.toggle("hidden", o !== id); });
    if (!id) overlays.forEach(function (o) { $(o).classList.add("hidden"); });
  }
  function setState(s2) {
    state = s2;
    if (s2 === "playing") showOnly(null);
    else if (s2 === "paused") showOnly("ovPause");
    else if (s2 === "clear") showOnly("ovClear");
    else if (s2 === "over") showOnly("ovOver");
    updateHUD();
  }

  function levelClear() {
    setState("clear"); sfx("level");
    var k = killedThisLevel;
    $("clearLv").textContent = level;
    $("clearStats").innerHTML = "普通 ×" + k.normal + "　快速 ×" + k.fast + "　装甲 ×" + k.armor;
    $("clearScore").textContent = k.score;
    store.save = { level: Math.min(level + 1, MAXLV), scores: players.map(function (p) { return p.score; }) };
    store.highLv = Math.max(store.highLv, level); persist();
    $("btnContinue").style.display = ""; $("contLv").textContent = store.save.level;
    $("btnNext").textContent = level >= MAXLV ? "查看通关结算" : "进入下一关";
  }

  function settleOver(title, reason, sound) {
    setState("over"); sfx(sound); bgmOff();
    var total = players.reduce(function (s2, p) { return s2 + p.score; }, 0);
    $("overTitle").innerHTML = title;
    $("overReason").textContent = reason;
    $("overScore").textContent = total;
    var isNew = false;
    if (total > store.high) { store.high = total; isNew = true; }
    $("overNew").style.display = isNew ? "block" : "none";
    $("overHigh").textContent = store.high;
    store.save = null; persist();
    $("btnContinue").style.display = "none";
    $("hud").style.display = "none";
  }
  function gameOver(reason) { settleOver("游戏结束", reason, "over"); }
  function winGame() { settleOver("🏆 <b>通关</b>！", "你守住了基地，击败了全部 " + MAXLV + " 关敌人！", "level"); }

  /* ============ 主循环（固定时间步长 + 帧率无关）============ */
  function loop(ts) {
    animId = requestAnimationFrame(loop);
    try {
      var frame = ts - last; last = ts;
      if (frame > 250) frame = 250;                       // 失焦/长卡防螺旋
      if (state === "playing") {
        acc += frame;
        var guard = 0;
        while (acc >= FIXED_DT * 1000 && guard < 8) {
          step(FIXED_DT); acc -= FIXED_DT * 1000; guard++;
          if (state !== "playing") { acc = 0; break; }
        }
      } else acc = 0;
      if (state !== "menu" && map.length) render();
    } catch (err) { onFatal(err); }
  }

  /* ============ 输入 ============ */
  window.addEventListener("keydown", function (e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(e.key) >= 0) e.preventDefault();
    if (state !== "playing") menuNav(e);
    if (e.key === "Escape" || k === "p") {
      if (state === "playing") setState("paused");
      else if (state === "paused") setState("playing");
    }
    keys[k] = true;
    if (!actx) { audio(); bgmOn(); }
  });
  window.addEventListener("keyup", function (e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = false;
  });
  // 失焦自动暂停（AC-9.3）
  window.addEventListener("blur", function () { if (state === "playing") setState("paused"); });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && state === "playing") setState("paused");
  });

  // 菜单键盘导航
  var selIdx = 0;
  function curMenu() {
    var ov = overlays.find(function (o) { return !$(o).classList.contains("hidden"); });
    if (!ov) return null;
    return Array.prototype.slice.call($(ov).querySelectorAll(".btn")).filter(function (b) { return b.offsetParent !== null; });
  }
  function highlight(btns) { btns.forEach(function (b, i) { b.classList.toggle("sel", i === selIdx); }); }
  function menuNav(e) {
    var btns = curMenu(); if (!btns || !btns.length) return;
    if (e.key === "ArrowDown") { selIdx = (selIdx + 1) % btns.length; highlight(btns); e.preventDefault(); }
    else if (e.key === "ArrowUp") { selIdx = (selIdx - 1 + btns.length) % btns.length; highlight(btns); e.preventDefault(); }
    else if (e.key === "Enter") { if (btns[selIdx]) btns[selIdx].click(); e.preventDefault(); }
  }
  function resetSel() { selIdx = 0; setTimeout(function () { var b = curMenu(); if (b) highlight(b); }, 0); }

  /* ============ 按钮事件 ============ */
  $("mainMenu").addEventListener("click", function (e) {
    var act = e.target.dataset.act; if (!act) return;
    if (!actx) { audio(); bgmOn(); }
    if (act === "start") { resumeFlag = false; newGame(); }
    else if (act === "continue") { resumeFlag = true; newGame(); }
    else if (act === "mode") { showOnly("ovMode"); resetSel(); }
    else if (act === "settings") { syncSettings(); showOnly("ovSet"); resetSel(); }
    else if (act === "highscore") { showHigh(); showOnly("ovHigh"); resetSel(); }
    else if (act === "help") { showOnly("ovHelp"); resetSel(); }
  });
  $("ovMode").addEventListener("click", function (e) {
    var m = e.target.dataset.mode;
    if (m) { mode = +m; store.mode = mode; persist(); $("modeLabel").textContent = mode === 2 ? "双人" : "单人"; backMenu(); }
  });
  Array.prototype.forEach.call(document.querySelectorAll(".back"), function (b) { b.addEventListener("click", backMenu); });
  function backMenu() { showOnly("ovMenu"); refreshMenu(); resetSel(); }
  function refreshMenu() {
    $("modeLabel").textContent = mode === 2 ? "双人" : "单人";
    $("btnContinue").style.display = store.save ? "" : "none";
    if (store.save) $("contLv").textContent = store.save.level;
  }
  $("btnResume").onclick = function () { setState("playing"); };
  $("btnRestart").onclick = function () { startLevel(level, players.map(function (p) { return p.score; })); };
  $("btnQuit").onclick = function () { state = "menu"; bgmOff(); backMenu(); };
  $("btnNext").onclick = function () { if (level >= MAXLV) winGame(); else startLevel(level + 1, players.map(function (p) { return p.score; })); };
  $("btnAgain").onclick = function () { resumeFlag = false; mode = store.mode; newGame(); };
  $("btnMenu").onclick = function () { state = "menu"; backMenu(); };
  $("footHelp").onclick = function () { if (state === "menu") { showOnly("ovHelp"); resetSel(); } };

  /* ============ 设置开关 ============ */
  function bindSwitch(el, key, after) {
    $(el).addEventListener("click", function () {
      store[key] = !store[key]; $(el).classList.toggle("on", store[key]); persist(); if (after) after();
    });
  }
  bindSwitch("swBgm", "bgm", function () { store.bgm ? bgmOn() : bgmOff(); });
  bindSwitch("swSfx", "sfx");
  bindSwitch("swTouch", "touch", applyTouch);
  function syncSettings() {
    $("swBgm").classList.toggle("on", store.bgm);
    $("swSfx").classList.toggle("on", store.sfx);
    $("swTouch").classList.toggle("on", store.touch);
  }
  $("resetData").onclick = function () {
    try { localStorage.removeItem(KEY); } catch (e) { }
    store = { high: 0, highLv: 1, save: null, bgm: false, sfx: true, touch: false, mode: 1 };
    mode = 1; syncSettings(); refreshMenu(); applyTouch(); toast("本地存档已清除");
  };
  function showHigh() {
    $("highBig").textContent = store.high;
    $("highLv").textContent = store.highLv;
    $("highSave").textContent = store.save ? ("第" + store.save.level + "关") : "无";
  }

  /* ============ 触屏控件 ============ */
  var touchDir = null, touchFire = false;
  function applyTouch() { $("touch").classList.toggle("on", store.touch); }
  if ("ontouchstart" in window) { store.touch = true; persist(); }
  applyTouch(); syncSettings();
  Array.prototype.forEach.call(document.querySelectorAll(".dpad button[data-d]"), function (b) {
    var d = b.dataset.d;
    var on = function (e) { e.preventDefault(); touchDir = d; if (!actx) { audio(); bgmOn(); } };
    var off = function (e) { e.preventDefault(); if (touchDir === d) touchDir = null; };
    b.addEventListener("touchstart", on); b.addEventListener("touchend", off);
    b.addEventListener("mousedown", on); b.addEventListener("mouseup", off); b.addEventListener("mouseleave", off);
  });
  var fb = document.querySelector(".fire");
  ["touchstart", "mousedown"].forEach(function (ev) {
    fb.addEventListener(ev, function (e) { e.preventDefault(); touchFire = true; setTimeout(function () { touchFire = false; }, 120); });
  });

  /* ============ Toast ============ */
  var toastTimer = null;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 1600);
  }

  /* ============ 全局异常友好提示（AC-NFR-4.2，不白屏）============ */
  function onFatal(err) {
    try {
      if (animId) cancelAnimationFrame(animId);
      console.error("[坦克大战] 运行时异常：", err);
      var box = $("ovOver");
      $("overTitle").innerHTML = "出错了";
      $("overReason").textContent = "游戏遇到意外错误，已安全停止。可点击「返回主菜单」重试。";
      $("overScore").textContent = "—";
      $("overNew").style.display = "none";
      $("overHigh").textContent = store.high;
      showOnly("ovOver"); state = "over";
    } catch (e) { /* 兜底，绝不抛到顶层 */ }
  }
  window.addEventListener("error", function (e) { onFatal(e.error || e.message); });
  window.addEventListener("unhandledrejection", function (e) { onFatal(e.reason); });

  /* ============ 启动 ============ */
  refreshMenu(); resetSel();
  last = performance.now();
  requestAnimationFrame(loop);
})();
