/*
 * 世界状态与玩家逻辑（FR-2/FR-3/FR-5/FR-6）。纯逻辑、与渲染解耦。
 * update() 推进一固定步长，并返回本步发生的事件列表，供渲染/音效/HUD 消费。
 */
import {
  LANE_W, ROW_GAP, JUMP_V, GRAV, SLIDE_T, LANE_LERP, TURN_DECISION,
  speedAt, scoreOf,
} from '../config.js';
import { TrackGenerator } from './track.js';
import { checkCollision, collectCoins } from './collision.js';

export class World {
  constructor() {
    this.track = new TrackGenerator();
    this.reset();
  }

  reset() {
    this.track.reset(1);
    this.speed = speedAt(0);
    this.distance = 0;
    this.coins = 0;
    this.score = 0;
    this.runTime = 0;
    this.over = false;
    this.overReason = null;
    this.activeTurn = null; // { index, dir }
    this._events = [];
    this.player = {
      lane: 0, targetLane: 0, laneX: 0,
      y: 0, vy: 0, onGround: true,
      sliding: false, slideTimer: 0,
      s: 0, action: 'run',
      armedTurnIndex: -1, lastCellIndex: 0,
    };
  }

  // 将一个输入意图应用到玩家（在路口时 left/right 解释为转向）
  applyIntent(type) {
    if (this.over) return;
    const p = this.player;
    if (type === 'left' || type === 'right') {
      const dir = type === 'left' ? -1 : 1;
      if (this.activeTurn) {
        // 路口：方向匹配则武装转向（AC-3.1），不匹配则忽略（终将冲出赛道）
        if (dir === this.activeTurn.dir) p.armedTurnIndex = this.activeTurn.index;
        return;
      }
      p.targetLane = Math.max(-1, Math.min(1, p.targetLane + dir)); // 变道，越界忽略（AC-3.8）
    } else if (type === 'jump') {
      if (p.onGround && !p.sliding) {
        p.vy = JUMP_V; p.onGround = false; p.action = 'jump';
        this._emit('jump');
      } // 空中再按跳：忽略（AC-3.10 既定规则）
    } else if (type === 'slide') {
      if (p.onGround && !p.sliding) {
        p.sliding = true; p.slideTimer = SLIDE_T; p.action = 'slide';
        this._emit('slide');
      }
    }
  }

  // dt：固定步长；intents：本步要应用的输入意图（在 update 内按顺序消费，保证事件齐全）
  update(dt, intents = []) {
    this._events = [];
    if (this.over) return this._events;
    const p = this.player;
    for (const it of intents) this.applyIntent(it.type || it);

    // 速度曲线（平滑递增、封顶）
    this.runTime += dt;
    this.speed = speedAt(this.runTime);

    // 前进
    const ds = this.speed * dt;
    p.s += ds;
    this.distance = p.s;

    // 变道插值
    const tx = p.targetLane * LANE_W;
    p.laneX += (tx - p.laneX) * Math.min(1, LANE_LERP * dt);

    // 跳跃 / 重力
    if (!p.onGround) {
      p.vy -= GRAV * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; this._emit('land'); }
    }
    // 滑铲计时
    if (p.sliding) {
      p.slideTimer -= dt;
      if (p.slideTimer <= 0) { p.sliding = false; }
    }
    // 动作状态
    p.action = !p.onGround ? 'jump' : (p.sliding ? 'slide' : 'run');

    // 持续生成 / 回收
    this.track.ensureAhead(p.s, 80);
    this.track.recycleBehind(p.s);

    // 路口提示与转向判定
    this._updateTurns();

    // cell 跨越：检查上一个 cell 是否为“漏转的路口”
    const curIndex = Math.floor(p.s / ROW_GAP);
    if (curIndex !== p.lastCellIndex) {
      for (let i = p.lastCellIndex; i < curIndex; i++) {
        const left = this.track.get(i);
        if (left && left.turnDir !== 0 && p.armedTurnIndex !== left.index) {
          return this._gameOver('offtrack');
        }
      }
      p.lastCellIndex = curIndex;
    }

    // 碰撞
    const cell = this.track.get(curIndex);
    if (checkCollision(p, cell)) return this._gameOver('collision');

    // 金币
    const got = collectCoins(p, cell);
    if (got) { this.coins += got; this._emit('coin', got); }

    // 计分
    this.score = scoreOf(this.distance, this.coins);
    return this._events;
  }

  _updateTurns() {
    const p = this.player;
    const startIndex = Math.floor(p.s / ROW_GAP);
    let found = null;
    for (let i = startIndex; i < startIndex + 4; i++) {
      const c = this.track.get(i);
      if (c && c.turnDir !== 0) {
        const pivotS = (c.index + 1) * ROW_GAP; // 转弯发生在该 cell 末端
        if (pivotS - p.s <= TURN_DECISION && pivotS - p.s > -ROW_GAP) {
          found = { index: c.index, dir: c.turnDir };
        }
        break;
      }
    }
    const prev = this.activeTurn;
    this.activeTurn = found;
    if (found) {
      p.targetLane = 0; // 接近路口自动回中，避免转弯处车道轴突变
      if (!prev || prev.index !== found.index) this._emit('turnPrompt', found.dir);
    } else if (prev && p.armedTurnIndex === prev.index) {
      // 刚完成一次成功转向
      this._emit('turn', prev.dir);
    }
  }

  _gameOver(reason) {
    this.over = true;
    this.overReason = reason;
    this._emit('over', reason);
    return this._events;
  }

  _emit(type, value) { this._events.push({ type, value }); }
}
