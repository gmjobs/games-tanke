# 神庙逃亡 · 在线版（Temple Run Online）

纯前端、即点即玩的 **Three.js 真 3D 无尽跑酷**。浏览器打开链接即可游玩，无需下载、注册或后端。
实现已评审规格 / 技术方案 / 交互原型中的完整闭环：**奔跑 → 闪避/收集 → 失败 → 计分 → 重开**，
并满足画质（3D 场景、光照阴影、材质、粒子特效、Bloom/FXAA 后处理）与流畅度（固定步长循环、对象池、画质自适应）双目标。

## 运行

```bash
npm install        # 安装依赖（three / vitest），three 运行时已内置于 vendor/
npm run dev        # 启动本地服务器 → http://localhost:5173
# 或
npm start
```

> 说明：游戏使用 ES Module + importmap 加载 Three.js，需经 http(s) 访问，**不能用 `file://` 直接打开**
> （浏览器会拦截跨源模块加载）。`vendor/` 内已内置 Three.js 运行时（核心 + postprocessing/shaders 插件），
> 因此本地与离线均可运行，无需联网拉取 CDN。

## 构建与部署

```bash
npm run build      # 生成 dist/（index.html + src/ + vendor/ 静态包）
```

将 `dist/` 整目录上传至任意 HTTPS 静态托管即可上线。`vendor/` 走长缓存（immutable），二次访问明显更快（NFR-2）。

## 测试

```bash
npm test           # vitest：速度曲线/计分、可行性校验、碰撞与通道判定、世界推进（纯逻辑单测）
```

## 操作

| 输入 | 操作 |
|---|---|
| `← →` / `A D` / 左右滑动 | 变道；路口处按提示方向转向 |
| `↑` / `空格` / `W` / 上滑 | 跳跃（越过矮障碍/沟壑） |
| `↓` / `S` / 下滑 | 滑铲（通过高处障碍） |
| `P` / ⏸ 按钮 | 暂停 / 继续 |

开始界面可切换 **画质（高/流畅）、音效（开/关）、帧率显示**；切到后台自动暂停；最高分本地保存（localStorage）。

## 架构（严格遵循技术方案分层）

```
src/
├─ main.js              入口编排：能力探测 → 渐进加载 → 状态机 → 主循环
├─ config.js            常量与速度曲线/计分（纯逻辑，可单测）
├─ core/
│  ├─ state.js          状态机 loading/menu/play/pause/over
│  └─ loop.js           固定步长 update + 渲染插值（逻辑/帧率解耦）
├─ input/input.js       键盘 + 触摸四向滑动 → 意图队列（去抖/优先级）
├─ logic/               与渲染解耦的世界逻辑
│  ├─ world.js          玩家/速度/跳跃/滑铲/转向/计分，产出事件
│  ├─ track.js          赛道路径生成（含转弯）+ 可行性校验 + 对象回收
│  └─ collision.js      AABB 碰撞 + 跳跃/滑铲通道判定 + 金币吸收
├─ render/              Three.js 渲染层（WebGL2）
│  ├─ scene.js          Scene/Camera/光照阴影/雾/第三人称跟随/Bloom+FXAA
│  ├─ character.js      程序化可动画跑者（奔跑/跳跃/滑铲姿态）
│  ├─ pools.js          路段/障碍/金币/粒子对象池，逐帧同步世界状态
│  └─ quality.js        画质分级 + FPS 动态降档（迟滞）
├─ platform/            localStorage 最高分/设置、WebAudio 合成音效、可观测性
└─ ui/ui.js             复用原型 DOM/CSS 的 HUD/开始/暂停/结算 Overlay
```

逻辑层只产出「世界状态 + 事件」，渲染层据此更新场景图；二者解耦保证不同设备物理一致、输入响应稳定。
赛道在玩家前方持续生成、身后回收复用，避免内存无限增长。FPS 监测驱动画质动态降档，优先保帧率。

## 范围说明

纯单人无尽跑酷；无账号/登录、无在线榜单（最高分仅本地）、无内购/广告、无多人对战 —— 与规格「明确不做的事」一致。
