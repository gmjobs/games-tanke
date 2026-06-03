/*
 * 坦克大战豪华版 —— 逻辑层（单一事实来源 / Single Source of Truth）
 * 纯函数 + 配置数据，不依赖 DOM / Canvas，可在浏览器与 Node(Vitest) 下复用。
 * 设计依据：技术方案「数据驱动 + 分层解耦」，核心规则在此实现并单测覆盖。
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.TankLogic = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ============ 网格常量 ============ */
  var TILE = 20, COLS = 26, ROWS = 26;
  var W = COLS * TILE, H = ROWS * TILE;
  var TS = 2 * TILE;                 // 坦克 40px（2×2 子格）
  var MAXLV = 10, MAX_ENEMY_SCREEN = 4;
  var FIXED_DT = 1 / 60;             // 固定逻辑步长（帧率无关 AC-3.4）

  /* 地形枚举 */
  var EMPTY = 0, BRICK = 1, STEEL = 2, GRASS = 3, WATER = 4;

  /* ============ 敌人类型配置（数据驱动 NFR-5.1 / AC-4.2）============ */
  var ENEMY_TYPES = {
    normal: { speed: 62, hp: 1, score: 100, color: "#9aa6b8" },
    fast: { speed: 118, hp: 1, score: 200, color: "#7ad6ff" },
    armor: { speed: 46, hp: 3, score: 400, color: "#c9a14a" }
  };

  /* ============ 道具配置（共 6 种，AC-6.1）============ */
  var ITEM_TYPES = {
    fire: { glyph: "火", color: "#ff8a3a", timed: true, duration: 15, label: "火力增强" },
    shield: { glyph: "盾", color: "#4fc3f7", timed: true, duration: 10, label: "护盾无敌" },
    bomb: { glyph: "炸", color: "#ff5a5a", timed: false, label: "清屏炸弹" },
    life: { glyph: "命", color: "#5fd35f", timed: false, label: "加命 +1" },
    freeze: { glyph: "停", color: "#c08cff", timed: true, duration: 8, label: "敌人定身" },
    fortify: { glyph: "固", color: "#ffce3a", timed: true, duration: 18, label: "基地加固" }
  };
  var ITEM_KEYS = Object.keys(ITEM_TYPES);

  /* 基地（鹰）位置与堡垒砖墙（U 形包围）格坐标 */
  var BASE_C = 12, BASE_R = 24;
  var FORT = [
    [11, 23], [12, 23], [13, 23], [14, 23],
    [11, 24], [14, 24],
    [11, 25], [14, 25]
  ];

  /* ============ 确定性随机（线性同余）============ */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* ============ 关卡配置（数据驱动，难度递增 AC-7.3）============ */
  function levelConfig(n) {
    return {
      total: Math.min(8 + n * 2, 24),                  // 本关敌人总数（默认随关卡递增）
      fast: n >= 2 ? 0.25 + 0.02 * n : 0.1,             // 快速兵占比
      armor: n >= 3 ? 0.12 + 0.03 * n : 0,              // 装甲兵占比
      seed: n * 7919 + 13,                              // 地图确定性种子
      terrain: 6 + n                                    // 障碍簇数量
    };
  }

  /* ============ 地图生成（确定性 + 安全区保障）============ */
  function buildMap(n) {
    var cfg = levelConfig(n), rnd = rng(cfg.seed);
    var map = [];
    for (var r = 0; r < ROWS; r++) {
      var row = new Array(COLS);
      for (var c = 0; c < COLS; c++) row[c] = EMPTY;
      map.push(row);
    }
    var base = { c: BASE_C, r: BASE_R, alive: true };
    // 基地堡垒砖墙
    for (var f = 0; f < FORT.length; f++) map[FORT[f][1]][FORT[f][0]] = BRICK;

    var spawnZones = [[0, 0], [12, 0], [24, 0]]; // 敌人出生点（≥2 个）
    function safe(c, r) {
      if (r >= 23 && c >= 11 && c <= 14) return false;                 // 基地区
      if (r >= 23 && ((c >= 7 && c <= 9) || (c >= 16 && c <= 18))) return false; // 玩家出生区
      for (var i = 0; i < spawnZones.length; i++) {
        if (Math.abs(c - spawnZones[i][0]) < 3 && r < 3) return false; // 敌人出生区
      }
      return true;
    }
    var palette = [BRICK, BRICK, STEEL, GRASS, WATER];
    for (var i = 0; i < cfg.terrain; i++) {
      var t = palette[Math.floor(rnd() * palette.length)];
      var cc = 2 + Math.floor(rnd() * (COLS - 4));
      var rr = 3 + Math.floor(rnd() * (ROWS - 8));
      var w = 1 + Math.floor(rnd() * 3), h = 1 + Math.floor(rnd() * 3);
      for (var dr = 0; dr < h; dr++) for (var dc = 0; dc < w; dc++) {
        var c2 = cc + dc, r2 = rr + dr;
        if (c2 < COLS && r2 < ROWS && safe(c2, r2) && map[r2][c2] === EMPTY) map[r2][c2] = t;
      }
    }
    return { map: map, base: base, spawnZones: spawnZones };
  }

  /* ============ 碰撞 / 判定（纯函数，可单测）============ */
  function tileSolid(t) { return t === BRICK || t === STEEL || t === WATER; }

  // 子弹命中地形结果：stop=是否阻挡子弹，destroy=该格是否被摧毁
  function bulletTile(t, power) {
    if (t === BRICK) return { stop: true, destroy: true };
    if (t === STEEL) return { stop: true, destroy: !!power };       // 钢墙仅破钢子弹可摧毁（AC-2.3）
    return { stop: false, destroy: false };                          // 草丛/水/空：子弹穿过
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // 指定矩形是否与实体地形相交（含越界）
  function rectHitsMap(map, x, y, w, h) {
    if (x < 0 || y < 0 || x + w > W || y + h > H) return true;
    var c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 1) / TILE);
    var r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 1) / TILE);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      if (tileSolid(map[r][c])) return true;
    }
    return false;
  }

  // 坦克移动到 (nx,ny) 是否被阻挡：地形 + 基地 + 其他坦克（防穿透 AC-5.4）
  function tankBlocked(world, tank, nx, ny) {
    if (rectHitsMap(world.map, nx, ny, TS, TS)) return true;
    var base = world.base;
    if (base && base.alive) {
      var bx = base.c * TILE, by = base.r * TILE;
      if (nx < bx + TS && nx + TS > bx && ny < by + TS && ny + TS > by) return true;
    }
    var tanks = world.tanks || [];
    for (var i = 0; i < tanks.length; i++) {
      var o = tanks[i];
      if (o === tank || !o.alive) continue;
      if (nx < o.x + o.w && nx + TS > o.x && ny < o.y + o.h && ny + TS > o.y) return true;
    }
    return false;
  }

  // 按关卡占比选择敌人类型（rndVal ∈ [0,1)）
  function pickEnemyType(cfg, rndVal) {
    if (rndVal < cfg.armor) return "armor";
    if (rndVal < cfg.armor + cfg.fast) return "fast";
    return "normal";
  }

  return {
    TILE: TILE, COLS: COLS, ROWS: ROWS, W: W, H: H, TS: TS,
    MAXLV: MAXLV, MAX_ENEMY_SCREEN: MAX_ENEMY_SCREEN, FIXED_DT: FIXED_DT,
    EMPTY: EMPTY, BRICK: BRICK, STEEL: STEEL, GRASS: GRASS, WATER: WATER,
    ENEMY_TYPES: ENEMY_TYPES, ITEM_TYPES: ITEM_TYPES, ITEM_KEYS: ITEM_KEYS,
    BASE_C: BASE_C, BASE_R: BASE_R, FORT: FORT,
    rng: rng, levelConfig: levelConfig, buildMap: buildMap,
    tileSolid: tileSolid, bulletTile: bulletTile, aabb: aabb,
    rectHitsMap: rectHitsMap, tankBlocked: tankBlocked, pickEnemyType: pickEnemyType
  };
});
