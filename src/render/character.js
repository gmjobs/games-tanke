/*
 * 程序化角色（AC-9.1/9.2）：用基础几何体搭建可动画的跑者，
 * 提供奔跑摆臂摆腿、跳跃、滑铲三种姿态，无需外部 glTF 资源即可运行。
 */
import * as THREE from 'three';

export class Runner {
  constructor() {
    this.group = new THREE.Group();

    const skin = new THREE.MeshStandardMaterial({ color: 0xffc98a, roughness: 0.7 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0xe8552e, roughness: 0.55, metalness: 0.05 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x3a4a6b, roughness: 0.6 });
    this.skin = skin; this.cloth = cloth;

    // 躯干
    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 4, 10), cloth);
    this.torso.position.y = 1.15;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // 头
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 14), skin);
    this.head.position.y = 1.7;
    this.head.castShadow = true;
    this.group.add(this.head);

    // 头巾/帽
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), cloth);
    cap.position.y = 1.78;
    this.group.add(cap);

    const limbGeo = new THREE.CapsuleGeometry(0.1, 0.5, 4, 8);
    // 手臂（以肩为枢轴）
    this.armL = this._limb(limbGeo, skin, -0.42, 1.45);
    this.armR = this._limb(limbGeo, skin, 0.42, 1.45);
    // 腿（以髋为枢轴）
    this.legL = this._limb(limbGeo, pants, -0.16, 0.85);
    this.legR = this._limb(limbGeo, pants, 0.16, 0.85);

    this.phase = 0;
  }

  _limb(geo, mat, x, pivotY) {
    const pivot = new THREE.Group();
    pivot.position.set(x, pivotY, 0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = -0.3;
    mesh.castShadow = true;
    pivot.add(mesh);
    this.group.add(pivot);
    return pivot;
  }

  // action: 'run'|'jump'|'slide'；speedScale 影响摆动频率
  update(dt, action, speedScale = 1) {
    this.phase += dt * 12 * speedScale;
    const sw = Math.sin(this.phase);
    const sw2 = Math.sin(this.phase + Math.PI);

    if (action === 'slide') {
      // 滑铲：整体后仰贴地
      this.group.rotation.x = -1.15;
      this.group.position.y = -0.35;
      this.armL.rotation.x = -2.4; this.armR.rotation.x = -2.4;
      this.legL.rotation.x = 0.2; this.legR.rotation.x = 0.5;
    } else if (action === 'jump') {
      this.group.rotation.x = 0.08;
      this.group.position.y = 0;
      this.armL.rotation.x = -2.2; this.armR.rotation.x = -2.0;
      this.legL.rotation.x = -0.7; this.legR.rotation.x = 0.5;
    } else {
      // 奔跑循环：手脚交替摆动
      this.group.rotation.x = 0.06;
      this.group.position.y = Math.abs(sw) * 0.06; // 轻微上下起伏
      this.armL.rotation.x = sw * 1.2;
      this.armR.rotation.x = sw2 * 1.2;
      this.legL.rotation.x = sw2 * 1.1;
      this.legR.rotation.x = sw * 1.1;
    }
  }

  reset() {
    this.phase = 0;
    this.group.rotation.set(0, 0, 0);
    this.group.position.set(0, 0, 0);
  }
}
