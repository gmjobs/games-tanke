<!-- 代码骨架已写入工作区：坦克大战豪华版 -->

All verified. The implementation is complete and validated.

## 完成总结

基于已评审的规格、技术方案与原型，我把原型补全为一个**完整、可直接运行**的分层工程，无任何 TODO／占位／空函数。逻辑层 18 项单测全绿，单文件构建成功（48.8 KB），评审修订（结算分数字号放大 2 号）已落实。

> 工作区原有的「神庙逃亡」three.js 项目此前已被移到 `_root_legacy_backup/`（且在 `.gitignore` 中），与本次「坦克大战豪华版」（default 应用，发布到 `games-tanke`）互不干扰，未误删。

### 创建的文件及职责

| 文件 | 职责 |
|------|------|
| **`index.html`** | 页面骨架 + 内联 CSS，完全沿用评审原型 DOM 结构（主菜单/模式/设置/最高分/帮助/HUD/暂停/过关结算/结束结算/触屏/toast）。**落实评审修订**：游戏结束分数用独立 `.over-score` 类 **88px**（原型 64px 再放大 2 号）；新增 `#chipEff` 限时效果倒计时 HUD（AC-6.3）。通过两个 `<script>` 引入逻辑层与引擎层。 |
| **`src/logic.js`** | 逻辑层（单一事实来源）：网格常量、敌人/道具/关卡配置、确定性随机、地图生成（含安全区）、地形/AABB/坦克防穿透/基地碰撞、敌人选型等**纯函数**。同时挂 `window.TankLogic` 与 `module.exports`，浏览器与 Node 共用。 |
| **`src/game.js`** | 引擎层：**固定时间步长**主循环（帧率无关 AC-3.4，含防螺旋）、FSM、玩家四向移动/射击、敌人 AI（移动/转向/射击/趋向基地）、持续刷怪与同屏上限、子弹↔坦克/地形/基地/互相抵消、**6 种道具**（即时+限时计时与到期回滚提示）、计分/HUD、单关与通关/失败结算、暂停与失焦自动暂停、双人独立按键与分别计分、触屏控件、WebAudio 音效/BGM、localStorage 持久化、全局异常友好提示（不白屏）。规则全部取自 `TankLogic`，不重复实现。 |
| **`src/logic.test.js`** | Vitest 单测，18 用例覆盖网格常量、地形/子弹碰撞、AABB、坦克阻挡与防穿透、敌人选型、关卡难度递增、道具配置、地图确定性与安全区。 |
| **`package.json`** | 依赖与脚本：`dev`/`start`、`build`、`test`/`test:watch`。 |
| **`vitest.config.js`** | 测试范围限定 `src/**`，排除 `_root_legacy_backup`。 |
| **`serve.js`** | 零依赖静态服务器（防目录穿越），`npm run dev` → `localhost:5173`。 |
| **`build.js`** | 把 `index.html`+两个 JS 内联为 `dist/index.html` 单文件交付包。 |
| **`README.md`** | 运行/操作/测试/构建说明。 |

### 运行方式
- 直接双击 `index.html`（`file://` 可玩）；或 `npm run dev`；或 `npm run build` 生成单文件 `dist/index.html`。
- `npm install && npm test` 跑逻辑层单测（18 ✓）。

实现与已确认的技术方案（分层解耦、数据驱动、固定步长、DOM+Canvas 混合、localStorage 单键存档）和交互原型保持一致，未偏离已评审版本。
