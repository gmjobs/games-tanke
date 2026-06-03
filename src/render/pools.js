/*
 * 渲染世界视图（FR-4/FR-9）：对象池管理路段/障碍/金币/粒子，
 * 每帧据逻辑“世界状态”更新场景图，身后路段回收复用（NFR-1/NFR-8 防 GC 抖动）。
 */
import * as THREE from 'three';
import { ROW_GAP, ROAD_HALF, LANE_W } from '../config.js';
import { forwardVec, rightVec } from '../logic/track.js';
import { Runner } from './character.js';

function pool(factory) {
  const free = [];
  return {
    acquire() { return free.pop() || factory(); },
    release(o) { o.visible = false; free.push(o); },
  };
}

export class WorldView {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    this._shared();
    this.tiles = new Map();      // cellIndex -> TileView
    this._tilePool = [];
    this.particles = [];
    this.maxParticles = 120;
    this.drawAhead = 17;

    this.runner = new Runner();
    this.root.add(this.runner.group);
  }

  _shared() {
    this.geo = {
      road: new THREE.BoxGeometry(ROAD_HALF * 2, 0.4, ROW_GAP),
      rail: new THREE.BoxGeometry(0.18, 0.5, ROW_GAP),
      box: new THREE.BoxGeometry(1, 1, 1),
      coin: new THREE.CylinderGeometry(0.34, 0.34, 0.08, 18),
      spark: new THREE.IcosahedronGeometry(0.12, 0),
    };
    this.mat = {
      road: new THREE.MeshStandardMaterial({ color: 0xcdb892, roughness: 0.95 }),
      roadAlt: new THREE.MeshStandardMaterial({ color: 0xc2ac84, roughness: 0.95 }),
      rail: new THREE.MeshStandardMaterial({ color: 0x6b4d2e, roughness: 0.8 }),
      block: new THREE.MeshStandardMaterial({ color: 0x7a5b3a, roughness: 0.7 }),
      wall: new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.75 }),
      low: new THREE.MeshStandardMaterial({ color: 0xb5432e, roughness: 0.5 }),
      high: new THREE.MeshStandardMaterial({ color: 0x2e6fb5, roughness: 0.5 }),
      coin: new THREE.MeshStandardMaterial({ color: 0xffce4a, emissive: 0xffa400, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.3 }),
      spark: new THREE.MeshStandardMaterial({ color: 0xffd76b, emissive: 0xffae3a, emissiveIntensity: 1.2 }),
      dust: new THREE.MeshStandardMaterial({ color: 0xcbb48a, emissive: 0x000000, transparent: true, opacity: 0.7 }),
    };
    this._obstPool = pool(() => {
      const m = new THREE.Mesh(this.geo.box, this.mat.block);
      m.castShadow = true; m.receiveShadow = false;
      this.root.add(m); return m;
    });
    this._coinPool = pool(() => {
      const m = new THREE.Mesh(this.geo.coin, this.mat.coin);
      m.rotation.x = Math.PI / 2; this.root.add(m); return m;
    });
    this._sparkPool = pool(() => {
      const m = new THREE.Mesh(this.geo.spark, this.mat.spark);
      this.root.add(m); return m;
    });
  }

  _acquireTile() {
    let t = this._tilePool.pop();
    if (!t) {
      const group = new THREE.Group();
      const road = new THREE.Mesh(this.geo.road, this.mat.road);
      road.position.y = -0.2; road.receiveShadow = true;
      const railL = new THREE.Mesh(this.geo.rail, this.mat.rail);
      railL.position.set(-ROAD_HALF, 0.05, 0);
      const railR = new THREE.Mesh(this.geo.rail, this.mat.rail);
      railR.position.set(ROAD_HALF, 0.05, 0);
      group.add(road, railL, railR);
      this.root.add(group);
      t = { group, road, obstacles: [], coins: [] };
    }
    t.group.visible = true;
    return t;
  }

  _releaseTile(t) {
    for (const m of t.obstacles) this._obstPool.release(m);
    for (const c of t.coins) this._coinPool.release(c.mesh);
    t.obstacles.length = 0; t.coins.length = 0;
    t.group.visible = false;
    this._tilePool.push(t);
  }

  _buildTile(t, cell, track) {
    const centerS = cell.index * ROW_GAP + ROW_GAP / 2;
    const tf = track.transformAt(centerS);
    t.group.position.set(tf.x, 0, tf.z);
    t.group.rotation.y = cell.h;
    t.road.material = (cell.index % 2) ? this.mat.roadAlt : this.mat.road;

    for (const o of cell.obstacles) {
      const m = this._obstPool.acquire();
      m.visible = true;
      m.material = this.mat[o.kind] || this.mat.block;
      const lx = o.lane * LANE_W;
      if (o.kind === 'low') { m.scale.set(LANE_W * 0.9, 0.7, 0.7); m.position.set(0, 0.15, 0); }
      else if (o.kind === 'high') { m.scale.set(LANE_W * 0.95, 0.5, 0.7); m.position.set(0, 2.1, 0); }
      else if (o.kind === 'wall') { m.scale.set(LANE_W * 0.85, 2.4, 0.8); m.position.set(0, 1.0, 0); }
      else { m.scale.set(LANE_W * 0.8, 1.3, 0.9); m.position.set(0, 0.45, 0); }
      // 放入 tile 局部坐标（绕 Y 已由 group 旋转）
      m.position.x += lx;
      this._placeLocal(m, t.group, m.position.x, m.position.y, 0);
      t.obstacles.push(m);
    }
    for (const c of cell.coins) {
      const mesh = this._coinPool.acquire();
      mesh.visible = true;
      const y = c.arc ? 1.4 : 1.0; // 弧形金币贴近跳跃顶点，便于空中收集
      this._placeLocal(mesh, t.group, c.lane * LANE_W, y, 0);
      mesh.rotation.x = Math.PI / 2;
      t.coins.push({ mesh, ref: c });
    }
  }

  // 将子物体放到 tile 的世界位置（tile 自身已旋转，这里直接用世界变换避免双重旋转）
  _placeLocal(mesh, tileGroup, localX, y, localZ) {
    const h = tileGroup.rotation.y;
    const r = rightVec(h), f = forwardVec(h);
    mesh.position.set(
      tileGroup.position.x + r.x * localX + f.x * localZ,
      y,
      tileGroup.position.z + r.z * localX + f.z * localZ,
    );
    mesh.rotation.y = h;
  }

  setQuality(q) {
    const high = q === 'high';
    this.drawAhead = high ? 17 : 11;
    this.maxParticles = high ? 120 : 36;
  }

  // 每帧同步：t 为累计时间(用于金币旋转/粒子)
  sync(world, dt, t) {
    const track = world.track;
    const p = world.player;
    const curIndex = Math.floor(p.s / ROW_GAP);
    const lo = curIndex - 3, hi = curIndex + this.drawAhead;

    // 回收范围外 tile
    for (const [idx, tile] of this.tiles) {
      if (idx < lo || idx > hi) { this._releaseTile(tile); this.tiles.delete(idx); }
    }
    // 确保范围内 tile 存在
    for (let i = Math.max(0, lo); i <= hi; i++) {
      if (this.tiles.has(i)) continue;
      const cell = track.get(i);
      if (!cell) continue;
      const tile = this._acquireTile();
      this._buildTile(tile, cell, track);
      this.tiles.set(i, tile);
    }
    // 金币旋转 / 收集隐藏
    for (const tile of this.tiles.values()) {
      for (const c of tile.coins) {
        if (c.ref.collected) { if (c.mesh.visible) { this.coinBurst(c.mesh.position); c.mesh.visible = false; } }
        else c.mesh.rotation.z += dt * 6;
      }
    }

    // 角色位置
    const tf = track.transformAt(p.s);
    const f = forwardVec(tf.h), r = rightVec(tf.h);
    const wx = tf.x + r.x * p.laneX;
    const wz = tf.z + r.z * p.laneX;
    this.runner.group.position.set(wx, p.y, wz);
    this.runner.group.rotation.y = tf.h;
    this.runner.update(dt, p.action, Math.min(1.6, world.speed / 13));

    // 奔跑尘土
    if (!world.over && p.onGround && p.action === 'run') {
      this._dustTimer = (this._dustTimer || 0) - dt;
      if (this._dustTimer <= 0) { this._dustTimer = 0.07; this.dust(wx, wz, f); }
    }

    this._updateParticles(dt);
    return { pos: { x: wx, y: p.y, z: wz }, fwd: f };
  }

  // ---- 粒子特效 ----
  _spawnParticle(x, y, z, vx, vy, vz, life, scale, mat) {
    if (this.particles.length >= this.maxParticles) {
      const old = this.particles.shift(); this._sparkPool.release(old.mesh);
    }
    const m = this._sparkPool.acquire();
    m.visible = true; m.material = mat; m.scale.setScalar(scale);
    m.position.set(x, y, z);
    this.particles.push({ mesh: m, v: { x: vx, y: vy, z: vz }, life, age: 0 });
  }
  coinBurst(pos) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this._spawnParticle(pos.x, pos.y, pos.z, Math.cos(a) * 2, 2 + Math.random() * 2, Math.sin(a) * 2, 0.5, 1, this.mat.spark);
    }
  }
  crash(pos) {
    for (let i = 0; i < 18; i++) {
      this._spawnParticle(pos.x, pos.y + 1, pos.z, (Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6, 0.8, 1.4, this.mat.spark);
    }
  }
  dust(x, z, f) {
    this._spawnParticle(x - f.x * 0.4, 0.1, z - f.z * 0.4, (Math.random() - 0.5) * 1.5, 1 + Math.random(), (Math.random() - 0.5) * 1.5, 0.4, 1.2, this.mat.dust);
  }
  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.age += dt;
      if (pt.age >= pt.life) { this._sparkPool.release(pt.mesh); this.particles.splice(i, 1); continue; }
      pt.v.y -= 9 * dt;
      pt.mesh.position.x += pt.v.x * dt;
      pt.mesh.position.y += pt.v.y * dt;
      pt.mesh.position.z += pt.v.z * dt;
      const k = 1 - pt.age / pt.life;
      pt.mesh.scale.setScalar(Math.max(0.01, k) * 1.2);
    }
  }

  reset() {
    for (const [idx, tile] of this.tiles) { this._releaseTile(tile); }
    this.tiles.clear();
    for (const pt of this.particles) this._sparkPool.release(pt.mesh);
    this.particles.length = 0;
    this.runner.reset();
    this._dustTimer = 0;
  }
}
