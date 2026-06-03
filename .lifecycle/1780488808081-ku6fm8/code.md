<!-- 代码骨架已写入工作区：神庙逃亡 -->

All 16 tests pass and the build succeeds. The implementation is complete and verified end-to-end in a real browser engine (headless Chrome with software WebGL): boot completes, gameplay advances with correct scoring, coins auto-collect, collision/game-over/restart/pause all work with **zero runtime errors**.

## 完成总结

原工作区是一个无关的卡牌游戏脚手架（red-douluo），我已将其完全替换为**神庙逃亡在线版**——严格按已评审技术方案的分层（boot/core/input/logic/render/platform/ui）实现的 **Three.js 真 3D 无尽跑酷**，并复用了原型的 DOM/CSS、键位与玩法闭环。

### 新建 / 重写的文件

**工程与交付**
- `package.json` — 改为 temple-run-online，`type:module`，加入 three 依赖与 dev/start/build/test 脚本
- `index.html` — 保留原型全部 HUD/开始/暂停/结算/警告界面与 CSS，接入 importmap + ES Module 入口
- `serve.js` — 零依赖静态服务器（ESM），vendor 强缓存（NFR-2）
- `build.js` — 生成 `dist/` 静态交付包（index.html + src + vendor）
- `vendor/` — 内置 Three.js 运行时（核心 + postprocessing/shaders 插件），**离线可运行、无需 CDN**
- `README.md` — 运行/构建/操作/架构说明

**源码（`src/`）**
- `config.js` — 速度曲线、计分、几何/跳跃/滑铲常量（纯逻辑，可单测）
- `core/state.js`、`core/loop.js` — 状态机 + 固定步长循环（逻辑/帧率解耦，NFR-3）
- `input/input.js` — 键盘 + 触摸四向滑动 → 意图队列，去抖与优先级（AC-3.4/3.5）
- `logic/world.js`、`logic/track.js`、`logic/collision.js` — 玩家/速度/跳跃/滑铲/转向/计分、含转弯的赛道生成 + 可行性校验 + 回收、AABB 碰撞与通道判定（与渲染解耦）
- `render/scene.js`、`render/character.js`、`render/pools.js`、`render/quality.js` — 光照阴影/雾/第三人称跟随/Bloom+FXAA、程序化可动画跑者、对象池逐帧同步、FPS 动态降档
- `platform/storage.js`、`platform/audio.js`、`platform/telemetry.js` — 最高分/设置持久化、WebAudio 合成音效、FPS/加载耗时/错误捕获
- `ui/ui.js` — 复用原型界面的 Overlay/HUD 绑定
- `logic.test.js` — 16 条纯逻辑单测（速度曲线/计分/可行性/碰撞/世界推进）

### 验证结果
- `npm test` 16/16 通过；`npm run build` 产出 1.04MB 静态包
- 无头 Chrome 真机验证：加载完成可开始 → 奔跑计分正确（65m→分数75=距离+金币×10）→ 金币自动收集 → 撞障结算「撞上障碍」+ 最高分保存 → 再来一局复位 → P 键暂停，全程**零运行时错误**

一个说明点：方案采用真 3D（ES Module + importmap 加载 Three.js），因此需经 `npm run dev` 经 http 访问，不能 `file://` 直接打开——这是 3D 方案相对原型 Canvas2D 单文件的唯一运行方式差异，已在 README 注明。
