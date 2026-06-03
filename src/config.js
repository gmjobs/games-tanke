/*
 * 全局常量与可调参数（沿用已评审原型语义）。
 * 本文件无任何浏览器/Three.js 依赖，可在 Node 单测中直接引入。
 */

// ---- 赛道几何 ----
export const LANE_W = 1.42;                 // 车道间距（世界单位）
export const LANES = [-LANE_W, 0, LANE_W];  // 三车道
export const ROW_GAP = 6.2;                 // 每个 cell（行）的纵向长度
export const ROAD_HALF = LANE_W * 1.5 + 0.55; // 路面半宽

// ---- 速度曲线（FR-2 / AC-2.2 / AC-2.3） ----
export const SPEED = { start: 13, max: 30, accelPerSec: 0.18 };

// ---- 跳跃 / 滑铲（FR-3） ----
export const JUMP_V = 8.2;     // 起跳初速度
export const GRAV = 22.0;      // 重力加速度
export const SLIDE_T = 0.62;   // 滑铲持续时间(s)
export const JUMP_CLEAR = 1.0; // 越过 low 障碍所需的最小高度
export const LANE_LERP = 14;   // 变道插值速度（越大越跟手）

// ---- 障碍判定包围盒（纵向半长，单位：world z） ----
export const OBST_HALF_Z = 1.0;
export const COIN_HALF_Z = 0.9;

// ---- 转向（FR-3 / FR-5） ----
export const TURN_DECISION = ROW_GAP * 2.2; // 路口前提示/可操作的提前量

// ---- 计分 ----
export function speedAt(t) {
  return Math.min(SPEED.max, SPEED.start + SPEED.accelPerSec * t);
}
export function scoreOf(distance, coins) {
  return Math.floor(distance) + coins * 10;
}

// ---- 主循环 ----
export const FIXED_DT = 1 / 120;  // 逻辑固定步长，渲染插值（NFR-3 稳定输入）
export const MAX_FRAME = 0.1;     // 单帧 dt 上限，避免卡顿后“跳帧穿模”
