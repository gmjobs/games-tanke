import { describe, it, expect } from "vitest";
import L from "./logic.js";

describe("网格常量", () => {
  it("26×26 网格，坦克 40px，10 关", () => {
    expect(L.COLS).toBe(26);
    expect(L.ROWS).toBe(26);
    expect(L.TILE).toBe(20);
    expect(L.TS).toBe(40);
    expect(L.MAXLV).toBe(10);
    expect(L.MAX_ENEMY_SCREEN).toBe(4);
  });
});

describe("地形碰撞规则", () => {
  it("砖/钢/水阻挡坦克，空/草不阻挡", () => {
    expect(L.tileSolid(L.BRICK)).toBe(true);
    expect(L.tileSolid(L.STEEL)).toBe(true);
    expect(L.tileSolid(L.WATER)).toBe(true);
    expect(L.tileSolid(L.EMPTY)).toBe(false);
    expect(L.tileSolid(L.GRASS)).toBe(false);
  });
  it("普通子弹：砖墙被摧毁、钢墙无效", () => {
    expect(L.bulletTile(L.BRICK, false)).toEqual({ stop: true, destroy: true });
    expect(L.bulletTile(L.STEEL, false)).toEqual({ stop: true, destroy: false });
  });
  it("破钢子弹：钢墙可摧毁", () => {
    expect(L.bulletTile(L.STEEL, true)).toEqual({ stop: true, destroy: true });
  });
  it("草丛/水：子弹穿过", () => {
    expect(L.bulletTile(L.GRASS, false).stop).toBe(false);
    expect(L.bulletTile(L.WATER, false).stop).toBe(false);
  });
});

describe("AABB 相交", () => {
  it("重叠返回 true，分离返回 false", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(L.aabb(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(L.aabb(a, { x: 20, y: 20, w: 10, h: 10 })).toBe(false);
  });
});

describe("坦克阻挡 / 防穿透", () => {
  function emptyMap() {
    return Array.from({ length: L.ROWS }, () => new Array(L.COLS).fill(L.EMPTY));
  }
  it("越界被阻挡", () => {
    const w = { map: emptyMap(), base: null, tanks: [] };
    expect(L.tankBlocked(w, {}, -1, 0)).toBe(true);
    expect(L.tankBlocked(w, {}, L.W - L.TS + 1, 0)).toBe(true);
  });
  it("实体地形阻挡，空地放行", () => {
    const map = emptyMap();
    map[5][5] = L.STEEL;
    const w = { map, base: null, tanks: [] };
    expect(L.tankBlocked(w, {}, 5 * L.TILE, 5 * L.TILE)).toBe(true);
    expect(L.tankBlocked(w, {}, 0, 0)).toBe(false);
  });
  it("基地阻挡坦克穿越", () => {
    const w = { map: emptyMap(), base: { c: 12, r: 24, alive: true }, tanks: [] };
    expect(L.tankBlocked(w, {}, 12 * L.TILE, 24 * L.TILE)).toBe(true);
  });
  it("坦克之间不可重叠", () => {
    const me = { x: 0, y: 0, w: L.TS, h: L.TS, alive: true };
    const other = { x: 50, y: 0, w: L.TS, h: L.TS, alive: true }; // 占 50..90
    const w = { map: emptyMap(), base: null, tanks: [me, other] };
    expect(L.tankBlocked(w, me, 20, 0)).toBe(true);  // 20..60 会与 other 重叠
    expect(L.tankBlocked(w, me, 0, 0)).toBe(false);  // 0..40 不与 other 重叠，也不与自身碰撞
  });
});

describe("敌人选型（数据驱动占比）", () => {
  it("按阈值返回 armor/fast/normal", () => {
    const cfg = { armor: 0.2, fast: 0.3 };
    expect(L.pickEnemyType(cfg, 0.1)).toBe("armor");
    expect(L.pickEnemyType(cfg, 0.4)).toBe("fast");
    expect(L.pickEnemyType(cfg, 0.9)).toBe("normal");
  });
  it("三种类型属性各异（移速/血量/分值）", () => {
    const t = L.ENEMY_TYPES;
    expect(t.fast.speed).toBeGreaterThan(t.normal.speed);
    expect(t.armor.hp).toBeGreaterThan(t.normal.hp);
    expect(t.armor.score).toBeGreaterThan(t.fast.score);
  });
});

describe("关卡配置难度递增", () => {
  it("敌人总数随关卡不降（封顶 24）", () => {
    for (let n = 1; n < L.MAXLV; n++) {
      expect(L.levelConfig(n + 1).total).toBeGreaterThanOrEqual(L.levelConfig(n).total);
    }
    expect(L.levelConfig(L.MAXLV).total).toBeLessThanOrEqual(24);
  });
  it("高关卡出现装甲与更多快速兵", () => {
    expect(L.levelConfig(1).armor).toBe(0);
    expect(L.levelConfig(5).armor).toBeGreaterThan(0);
    expect(L.levelConfig(8).fast).toBeGreaterThan(L.levelConfig(1).fast);
  });
});

describe("道具配置", () => {
  it("恰好 6 种道具，限时类含 duration", () => {
    expect(L.ITEM_KEYS.length).toBe(6);
    ["fire", "shield", "bomb", "life", "freeze", "fortify"].forEach((k) => {
      expect(L.ITEM_TYPES[k]).toBeTruthy();
    });
    expect(L.ITEM_TYPES.fire.timed).toBe(true);
    expect(L.ITEM_TYPES.fire.duration).toBeGreaterThan(0);
    expect(L.ITEM_TYPES.bomb.timed).toBe(false);
  });
});

describe("地图生成", () => {
  it("同一关卡确定性生成（可重放）", () => {
    const a = JSON.stringify(L.buildMap(3).map);
    const b = JSON.stringify(L.buildMap(3).map);
    expect(a).toBe(b);
    expect(JSON.stringify(L.buildMap(4).map)).not.toBe(a);
  });
  it("基地位于底部中央并有堡垒砖墙", () => {
    const { map, base } = L.buildMap(1);
    expect(base.c).toBe(12);
    expect(base.r).toBe(24);
    L.FORT.forEach(([c, r]) => expect(map[r][c]).toBe(L.BRICK));
  });
  it("玩家出生区与基地区不被随机地形堵死", () => {
    for (let n = 1; n <= L.MAXLV; n++) {
      const { map } = L.buildMap(n);
      // 玩家出生格（7,24）与（16,24）保持空地
      expect(map[24][7]).toBe(L.EMPTY);
      expect(map[24][16]).toBe(L.EMPTY);
    }
  });
});
