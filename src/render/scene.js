/*
 * 渲染骨架（FR-9 / AC-9.1）：Three.js Scene/Camera/Renderer + 第三人称跟随相机、
 * 光照与阴影、雾与天空、后处理（Bloom/FXAA，仅高画质档）。
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const SKY = 0x9fd3e8;

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.quality = 'high';

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(SKY, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 30, 95);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 200);
    this.camera.position.set(0, 4, -7);

    this._buildLights();
    this._buildEnv();

    // 后处理
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.6, 0.85);
    this.composer.addPass(this.bloom);
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);
    this.composer.addPass(new OutputPass());

    // 相机平滑跟随状态
    this._camPos = new THREE.Vector3(0, 4, -7);
    this._camLook = new THREE.Vector3(0, 1.4, 0);
    this._shake = 0;
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x4a3b27, 0.85));
    const sun = new THREE.DirectionalLight(0xfff1d0, 1.5);
    sun.position.set(-8, 18, -6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const s = 24;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    this.sun = sun;
    this._sunTarget = sun.target;
    this.scene.add(sun.target);
  }

  _buildEnv() {
    // 远处装饰（柔和球体云）增加纵深，随相机循环复用
    const cloudGeo = new THREE.SphereGeometry(3, 10, 8);
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    this.clouds = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Mesh(cloudGeo, cloudMat);
      c.scale.setScalar(0.6 + (i % 3) * 0.5);
      this.clouds.add(c);
    }
    this.scene.add(this.clouds);
  }

  resize(w, h, dpr) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(w, h);
    const px = 1 / (w * dpr);
    const py = 1 / (h * dpr);
    this.fxaa.material.uniforms['resolution'].value.set(px, py);
    this.bloom.setSize(w, h);
  }

  setQuality(q) {
    this.quality = q;
    const high = q === 'high';
    this.renderer.shadowMap.enabled = high;
    this.sun.castShadow = high;
    this.scene.fog.far = high ? 95 : 70; // 低画质缩短绘制距离
    this.scene.traverse((o) => { if (o.isMesh) o.material.needsUpdate = true; });
  }

  // 第三人称跟随：pos=玩家世界坐标, fwd=前向单位向量, headY=注视高度
  follow(pos, fwd, headY, dt) {
    const back = 7.2, up = 4.0, ahead = 6.0;
    const desired = new THREE.Vector3(
      pos.x - fwd.x * back, pos.y + up, pos.z - fwd.z * back,
    );
    const look = new THREE.Vector3(
      pos.x + fwd.x * ahead, pos.y + headY, pos.z + fwd.z * ahead,
    );
    const k = Math.min(1, 9 * dt);
    this._camPos.lerp(desired, k);
    this._camLook.lerp(look, k);

    let sx = 0, sy = 0;
    if (this._shake > 0) {
      this._shake = Math.max(0, this._shake - dt * 2.5);
      const m = this._shake * 0.5;
      sx = (Math.sin(performance.now() * 0.05) ) * m;
      sy = (Math.cos(performance.now() * 0.043)) * m;
    }
    this.camera.position.set(this._camPos.x + sx, this._camPos.y + sy, this._camPos.z);
    this.camera.lookAt(this._camLook);

    // 阴影相机与云跟随玩家
    this.sun.position.set(pos.x - 8, pos.y + 18, pos.z - 6);
    this._sunTarget.position.set(pos.x, pos.y, pos.z + 4);
    this.clouds.position.set(pos.x, 16, pos.z + 40);
  }

  shake(amount = 1) { this._shake = Math.min(2, this._shake + amount); }

  render() {
    if (this.quality === 'high') this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() { this.renderer.dispose(); }
}
