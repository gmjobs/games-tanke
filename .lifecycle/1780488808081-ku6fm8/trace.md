<!-- 追溯映射：神庙逃亡 -->

I now have a complete picture. Here is the requirements traceability matrix.

# 神庙逃亡在线版 — 需求追溯映射（RTM）

> 说明：本表基于工作区实际代码（`src/**`、`index.html`）与测试（`src/**/*.test.js`）逐项核对填写。"状态"判据——**已实现**：有对应实现且有自动化/单测覆盖或可在主流程明确验证；**部分**：逻辑已实现但无专门自动化测试，或仅靠手工/集成验证；**缺失**：无对应实现或无法验证。
>
> 工程为纯前端 Three.js，渲染/UI/平台层依赖浏览器（`window`/`WebGL`/`localStorage`），单测集中在纯逻辑层（`logic`/`core`/`input`/`platform`/`render/quality`）；渲染观感、帧率、加载时间等属**人工/集成验收**范畴，无自动化测试。

## 一、功能需求（FR）

| 编号(AC/功能) | 业务释义 | 实现代码(文件:函数/类) | 对应测试 | 状态 |
|---|---|---|---|---|
| AC-1.1 | 访问即见开始界面（标题/操作说明/三组开关），无需登录 | `index.html`(`#menu`/`#startBtn`/操作说明/`#qSeg`/`#sSeg`/`#fSeg`)、`src/ui/ui.js:UI.showMenu` | 无（DOM 结构，手工验收 TC-1.01） | 部分 |
| AC-1.2 | 加载完成后点击/触摸开始，角色自动奔跑 | `src/main.js:boot`/`doStart`、`src/core/state.js:GameStateMachine.start`、`src/ui/ui.js:UI.enableStart` | `src/core/state.test.js`("loading 态下 start 无效…就绪后方可开始") | 已实现 |
| AC-1.3 | 资源未就绪时开始禁用、显示加载进度，不允许开始 | `src/main.js:boot`(`ui.setProgress`/`sm.ready`)、`src/ui/ui.js:UI.setProgress`/`enableStart`、`index.html`(`#startBtn disabled`) | `src/core/state.test.js`("初始相位为 loading"/"loading 态下 start 无效") | 已实现 |
| AC-2.1 | 无操作持续前进，动画与位移同步、无穿模抖动 | `src/logic/world.js:World.update`(`p.s += ds`)、`src/render/pools.js:WorldView.sync`、`src/render/character.js:Runner.update` | `src/logic.test.js`("持续推进：距离递增…")；视觉无抖动属人工(TC-2.01) | 部分 |
| AC-2.2 | 速度随时长按曲线递增且有上限 | `src/config.js:speedAt`/`SPEED`、`src/logic/world.js:World.update`(`speed=speedAt(runTime)`) | `src/logic.test.js`("起始速度…单调递增"/"速度封顶不超过 MAX") | 已实现 |
| AC-2.3 | 速度变化平滑无跳变 | `src/config.js:speedAt`(线性连续) | `src/logic.test.js`("速度封顶…") | 已实现 |
| AC-3.1 | 路口左/右转向使角色转入对应道路；非路口转向不出界（越界忽略） | `src/logic/world.js:World.applyIntent`(`armedTurnIndex`)/`_updateTurns`、`src/logic/track.js`(转弯 cell 朝向变更) | `src/logic/turns.test.js`("按对应方向→武装转向安全通过"/"按反方向→不武装") | 已实现 |
| AC-3.2 | 左/右滑动在赛道内变道贴边（-LANE_W/0/+LANE_W） | `src/logic/world.js:World.applyIntent`(`targetLane`)、`update`(`laneX` 插值)、`src/config.js:LANES`/`LANE_LERP` | `src/logic.test.js`("变道在合法范围内并越界忽略") | 已实现 |
| AC-3.3 | 上滑/跳跃越低障；下滑/滑铲过高障 | `src/logic/world.js:World.applyIntent`(`jump`/`slide`)、`src/logic/collision.js:checkCollision`(`low`/`high`) | `src/logic/turns.test.js`("滑铲持续约 SLIDE_T 后恢复"/临界越障)、`src/logic.test.js`("矮栏需跳过"/"高栏需滑铲") | 已实现 |
| AC-3.4 | 键盘(←→↑/空格↓ WASD)与触摸四向滑动两套输入均触发全部操作 | `src/input/input.js:InputManager._bind`(keydown + touch)、`poll` | `src/input/input.test.js`("队列收集与 poll") | 已实现 |
| AC-3.5 | 冲突操作(同时上下滑)有优先级/去抖，不进异常态 | `src/input/input.js:InputManager._resolve`、`src/logic/world.js:World.applyIntent`(滑铲中跳被忽略) | `src/input/input.test.js`("jump/slide 互斥取最新")、`src/logic/turns.test.js`("滑铲中按跳被忽略") | 已实现 |
| AC-3.6/3.7 (TC) | 路口正确转向通过 / 未转向冲出失败 | `src/logic/world.js:World.update`(cell 跨越漏转→`_gameOver('offtrack')`)、`_updateTurns` | `src/logic/turns.test.js`("路口不转向→冲出赛道失败") | 已实现 |
| AC-3.8 (TC) | 非路口转向规则明确（变道越界忽略，保持直行） | `src/logic/world.js:World.applyIntent`(`Math.max(-1,Math.min(1,…))`) | `src/logic.test.js`("变道…越界忽略") | 已实现 |
| AC-3.10 (TC) | 空中再次跳跃按既定规则（忽略二段跳） | `src/logic/world.js:World.applyIntent`(`if(p.onGround&&!p.sliding)`) | `src/logic/turns.test.js`("空中再次按跳被忽略") | 已实现 |
| AC-4.1 | 赛道随前进持续生成、视野无空洞 | `src/logic/track.js:TrackGenerator.ensureAhead`/`_appendCell`、`src/logic/world.js:World.update`(`ensureAhead(p.s,80)`) | `src/logic.test.js`("生成器产出的所有 cell 均可通过") | 已实现 |
| AC-4.2 | 路段含直道/转弯/障碍/金币且存在可通过路线 | `src/logic/track.js:validatePassable`/`_fillObstacles`、`_appendCell`(不可解兜底清空) | `src/logic.test.js`(可行性校验 4 例 + "无死局") | 已实现 |
| AC-4.3 | 远端/已过路段加载与回收，避免内存膨胀 | `src/logic/track.js:TrackGenerator.recycleBehind`、`src/render/pools.js:WorldView`(对象池 `_releaseTile`/`sync` 回收) | `src/logic.test.js`("长跑不抛异常 NFR-8")；内存属人工(TC-4.03) | 部分 |
| AC-5.1 | 与障碍有效碰撞触发失败 | `src/logic/collision.js:checkCollision`、`src/logic/world.js:World.update`(`_gameOver('collision')`) | `src/logic.test.js`("同车道实心块必撞") | 已实现 |
| AC-5.2 | 路口未转向冲出赛道失败 | `src/logic/world.js:World.update`(cell 跨越漏转判定)、`_gameOver('offtrack')` | `src/logic/turns.test.js`("路口不转向→冲出赛道失败") | 已实现 |
| AC-5.3 | 判定与画面一致（碰撞点匹配，纵向判定带） | `src/logic/collision.js:checkCollision`(`OBST_HALF_Z` 判定带)、`src/render/pools.js:WorldView._buildTile`(障碍尺寸/位置) | `src/logic/turns.test.js`("判定带之外不触发碰撞") | 已实现 |
| AC-5.4 | 跳跃临界越障（恰达 JUMP_CLEAR 即过） | `src/logic/collision.js:checkCollision`(`player.y<JUMP_CLEAR`)、`src/config.js:JUMP_CLEAR` | `src/logic/turns.test.js`("矮栏临界：恰好达到 JUMP_CLEAR 即可越过") | 已实现 |
| AC-5.5 | 滑铲临界过高障 | `src/logic/collision.js:checkCollision`(`!player.sliding`) | `src/logic.test.js`("高栏需滑铲：不滑撞，滑则过") | 已实现 |
| AC-6.1 | 经过金币自动收集、消失、计数即时更新 | `src/logic/collision.js:collectCoins`、`src/logic/world.js:World.update`(`coins+=got`/`_emit('coin')`)、`src/render/pools.js:WorldView.sync`(收集隐藏 `coinBurst`) | `src/logic.test.js`("金币自动收集且不重复计")、`src/logic/turns.test.js`("弧形金币需在空中才收集") | 已实现 |
| AC-6.2 | 实时显示距离/分数/金币 | `src/ui/ui.js:UI.updateHUD`、`src/main.js:render`(`ui.updateHUD`)、`index.html`(`#hDist`/`#hCoin`/`#hScore`) | 无（HUD 渲染，手工 TC-6.02） | 部分 |
| AC-6.3 | 结束展示最终分数/距离/金币 | `src/ui/ui.js:UI.showOver`、`src/main.js:endRun` | 无（Overlay 渲染，手工 TC-6.03） | 部分 |
| AC-6.4 | 本地保存并展示历史最高分，刷新纪录提示 | `src/platform/storage.js:getBest`/`setBest`、`src/main.js:endRun`(`isNewBest`)、`src/ui/ui.js:UI.showOver`(`newbest`) | `src/platform/storage.test.js`(最高分持久化 4 例) | 已实现 |
| AC-6.6 (TC) | 首次无历史时最高分初值 0，任意正分即新纪录 | `src/platform/storage.js:getBest`(默认 0)、`src/main.js:endRun`(`score>prevBest`) | `src/platform/storage.test.js`("无历史时最高分初值为 0") | 已实现 |
| AC-7.1 | 结算界面含成绩/最高分/重开/返回/结束原因 | `src/ui/ui.js:UI.showOver`(`oScore`/`oBest`/`overReason`)、`index.html`(`#over`/`#restartBtn`/`#homeBtn`) | `src/core/state.test.js`("失败进入 over 并携带原因") | 已实现 |
| AC-7.2 | 一键重开不刷新页面，重置并开始新局 | `src/main.js:doStart`(`world.reset`/`view.reset`/`input.reset`)、`src/core/state.js:start`/`restart` | `src/core/state.test.js`("over 态可直接 start 重开"/"restart 进入 play") | 已实现 |
| AC-7.3 | 重开后场景/角色/计分完全复位无残留 | `src/logic/world.js:World.reset`、`src/render/pools.js:WorldView.reset`、`src/render/character.js:Runner.reset` | `src/logic.test.js`("reset 完全复位")、`src/core/state.test.js`("toMenu 返回首页") | 已实现 |
| AC-8.1 | 手动暂停(P/⏸)停止运动并暂停输入 | `src/main.js:doPause`、`src/core/state.js:pause`、`src/main.js:update`(`if(!sm.is(PLAY))return`)、`src/ui/ui.js:UI.showPause` | `src/core/state.test.js`("暂停/恢复闭环") | 已实现 |
| AC-8.2 | 恢复后从暂停点继续，状态一致 | `src/main.js:doResume`(重置 `lastRender`)、`src/core/state.js:resume` | `src/core/state.test.js`("暂停/恢复闭环")、`src/logic/turns.test.js`("over 后 update 不改变世界")(间接) | 已实现 |
| AC-8.3 | 切后台/失焦自动暂停，回前台保持暂停 | `src/main.js:buildControls`(`visibilitychange`/`blur`→`doPause`) | 无（浏览器事件，手工 TC-8.04/8.05） | 部分 |
| AC-8.6 (TC) | 暂停/结束时不响应游戏输入 | `src/main.js:update`(非 PLAY 直接 return)、`src/logic/world.js:World.applyIntent`(`if(this.over)return`) | `src/logic/turns.test.js`("over 后 applyIntent 与 update 不再改变世界")、`src/core/state.test.js`("暂停态下不响应…非法转移") | 已实现 |
| AC-9.1 | 3D 场景/角色含光照阴影材质，观感精致 | `src/render/scene.js:SceneManager`(光照/阴影/雾/后处理)、`src/render/character.js:Runner`、`src/render/pools.js:WorldView`(材质) | 无（视觉观感，手工 TC-9.01） | 部分 |
| AC-9.2 | 关键动作有动画/特效反馈（金币/碰撞震屏/转向 flash/音效） | `src/render/pools.js`(`coinBurst`/`crash`/`dust`)、`src/render/scene.js:shake`、`src/ui/ui.js:flash`、`src/platform/audio.js:sfx`、`src/main.js:handleEvent` | 无（特效渲染，手工 TC-9.02） | 部分 |
| AC-9.3 | UI 风格统一清晰、随分辨率响应不变形 | `index.html`(CSS/Overlay)、`src/main.js:resizeAll`、`src/render/scene.js:resize` | 无（响应式视觉，手工 TC-9.03） | 部分 |

## 二、非功能需求（NFR）

| 编号 | 业务释义 | 实现代码(文件:函数/类) | 对应测试 | 状态 |
|---|---|---|---|---|
| NFR-1 | 高/低端设备稳定帧率，无频繁卡顿 | `src/core/loop.js:GameLoop`(固定步长+限幅+步数封顶)、`src/render/quality.js:QualityController.autoTune` | `src/core/loop.test.js`(步长/限幅 6 例)、`src/render/quality.test.js`(降档/迟滞) | 部分（机制有测试；实测帧率属人工 TC-N.01/02） |
| NFR-2 | 首屏可玩 ≤5s，渐进加载+进度提示，资源缓存 | `src/main.js:boot`(分步 `setProgress`)、`src/platform/telemetry.js:markLoadDone`、`serve.js`(vendor 强缓存) | `src/platform/storage.test.js`("加载耗时记录为非负数") | 部分（埋点有测试；实测时间属人工 TC-N.04） |
| NFR-3 | 输入到响应 ≤100ms，跟手无丢输入 | `src/core/loop.js:GameLoop`(逻辑/帧率解耦)、`src/input/input.js:InputManager.poll`、`src/config.js:FIXED_DT` | `src/core/loop.test.js`("累计余量跨帧保留")、`src/input/input.test.js` | 部分（机制有测试；端到端延迟属人工 TC-3.11） |
| NFR-4 | 主流浏览器+键盘/触摸+响应式+WebGL 不可用降级提示 | `src/main.js:webglOK`/`ui.showWarn`、`resizeAll`、`src/input/input.js`(双输入)、`index.html`(`#warn`) | 无（兼容性/降级，手工 TC-N.05+） | 部分 |
| NFR-5 | 画质分级 high/low + 自动/手动降档保帧率 | `src/render/quality.js:QualityController`、`src/render/scene.js:setQuality`、`src/render/pools.js:setQuality`、`src/platform/storage.js:getSettings`(quality) | `src/render/quality.test.js`(分级/透传/迟滞 8 例)、`src/platform/storage.test.js`(设置往返) | 已实现 |
| NFR-6 | 纯前端、不收集 PII、最高分仅本地、HTTPS | `src/platform/storage.js`(仅 `tr_best`/`tr_settings`)、`serve.js`(静态服务) | `src/platform/storage.test.js`("隐私模式…兜底") | 部分（HTTPS 属部署） |
| NFR-7 | FPS/加载耗时/JS 错误可观测与捕获 | `src/platform/telemetry.js:createFpsMeter`/`markLoadDone`/`installErrorCapture`、`src/ui/ui.js:setFps` | `src/platform/storage.test.js`(FPS 采样/加载耗时 3 例) | 已实现 |
| NFR-8 | 长时间不崩溃、不内存溢出、资源失败兜底 | `src/logic/track.js:recycleBehind`、`src/render/pools.js`(对象池)、`src/platform/storage.js`(try/catch)、`src/main.js:boot.catch`/`installErrorCapture` | `src/logic.test.js`("长跑不抛异常")、`src/platform/storage.test.js`(存储兜底) | 部分（10 分钟稳定性属人工 TC-N.03） |

## 三、缺口与风险（未实现 / 缺测试）

**无自动化测试（仅人工/集成验收，属渲染与浏览器集成层，难以单测）：**
- **AC-2.1（视觉无穿模抖动）**、**AC-6.2/6.3（HUD/结算渲染）**、**AC-9.1/9.2/9.3（3D 观感、特效、响应式 UI）**：实现存在于 `render/*`、`ui/ui.js`、`index.html`，但无 DOM/渲染快照测试，依赖手工 TC-2.01/6.02/6.03/9.01-9.03。
- **AC-8.3（切后台自动暂停）**：`main.js` 已绑定 `visibilitychange`/`blur`，但无事件级测试。
- **NFR-1/2/3 的量化指标**（≥60/30 FPS、≤5s 加载、≤100ms 延迟）：仅验证了解耦机制与埋点，**实测数值无自动化基准**，需在真机/集成环境按 TC-N.01–04 验收。
- **NFR-4 兼容性与降级**：`webglOK`+`#warn` 降级路径存在，但无跨浏览器自动化矩阵测试。

**规格中未见独立实现的项（建议确认）：**
- **AC-1.1 的"基本操作说明"**：以静态 `index.html` 文案承载，正确但无测试断言其完整性（应含 ←→/↑空格/↓/触屏/路口箭头/P 六项——已在 `index.html:115-120` 核对齐全）。
- **TC-8.03「暂停中退出本局」**：`main.js:doQuit→endRun('quit')` 已实现，但 `quit` 原因在 `ui.js:showOver` 中落入默认文案"撞上障碍"（`overReason` 仅区分 `offtrack`/其他），**退出原因文案不准确**，属轻微缺陷。
- 整体**无端到端/集成测试**（如 Playwright），代码总结中提到的"无头 Chrome 真机验证"为一次性手工验证，未沉淀为可回归的自动化用例——这是当前最大测试缺口。

```json
[
  {"id":"AC-1.1","desc":"访问即见开始界面（标题/操作说明/三组开关），无需登录","code":["index.html:#menu","src/ui/ui.js:UI.showMenu"],"tests":[],"status":"partial"},
  {"id":"AC-1.2","desc":"加载完成后开始，角色自动奔跑","code":["src/main.js:doStart","src/core/state.js:GameStateMachine.start"],"tests":["src/core/state.test.js"],"status":"done"},
  {"id":"AC-1.3","desc":"资源未就绪开始禁用并显示加载进度","code":["src/main.js:boot","src/ui/ui.js:UI.setProgress","src/ui/ui.js:UI.enableStart"],"tests":["src/core/state.test.js"],"status":"done"},
  {"id":"AC-2.1","desc":"无操作持续前进，动画位移同步无穿模","code":["src/logic/world.js:World.update","src/render/pools.js:WorldView.sync","src/render/character.js:Runner.update"],"tests":["src/logic.test.js"],"status":"partial"},
  {"id":"AC-2.2","desc":"速度随时长按曲线递增且有上限","code":["src/config.js:speedAt","src/logic/world.js:World.update"],"tests":["src/logic.test.js"],"status":"done"},
  {"id":"AC-2.3","desc":"速度变化平滑无跳变","code":["src/config.js:speedAt"],"tests":["src/logic.test.js"],"status":"done"},
  {"id":"AC-3.1","desc":"路口转向转入对应道路，非路口越界忽略","code":["src/logic/world.js:World.applyIntent","src/logic/world.js:World._updateTurns","src/logic/track.js:TrackGenerator._appendCell"],"tests":["src/logic/turns.test.js"],"status":"done"},
  {"id":"AC-3.2","desc":"左右滑动赛道内变道贴边","code":["src/logic/world.js:World.applyIntent","src/logic/world.js:World.update"],"tests":["src/logic.test.js"],"status":"done"},
  {"id":"AC-3.3","desc":"跳跃越低障/滑铲过高障","code":["src/logic/world.js:World.applyIntent","src/logic/collision.js:checkCollision"],"tests":["src/logic/turns.test.js","src/logic.test.js"],"status":"done"},
  {"id":"AC-3.4","desc":"键盘与触摸四向两套输入触发全部操作","code":["src/input/input.js:InputManager._bind","src/input/input.js:InputManager.poll"],"tests":["src/input/input.test.js"],"status":"done"},
  {"id":"AC-3.5","desc":"冲突操作优先级/去抖不进异常态","code":["src/input/input.js:InputManager._resolve","src/logic/world.js:World.applyIntent"],"tests":["src/input/input.test.js","src/logic/turns.test.js"],"status":"done"},
  {"id":"AC-3.8","desc":"非路口转向越界忽略保持直行","code":["src/logic/world.js:World.applyIntent"],"tests":["src/logic.test.js"],"status":"done"},
  {"id":"AC-3.10","desc":"空中再跳忽略（无二段跳）","code":["src/logic/world.js:World.applyIntent"],"tests":["src/logic/turns.test.js"],"status":"done"},
  {"id":"AC-4.1","desc":"赛道持续生成视野无空洞","code":["src/logic/track.js:TrackGenerator.ensureAhead","src/logic/track.js:TrackGenerator._appendCell"],"tests":["src/logic.test.js"],"status":"done"},
  {"id":"AC-4.2","desc":"路段含多元素且存在可通过路线","code":["src/logic/track.js:validatePassable","src/logic/track.js:TrackGenerator._fillObstacles"],"tests":["src/logic.test.js"],"status":"done"},
  {"id":"AC-4.3","desc":"远端/已过路段回收避免内存膨胀","code":["src/logic/track.js:TrackGenerator.recycleBehind","src/render/pools.js:WorldView._releaseTile"],"tests":["src/logic.test.js"],"status":"partial"},
  {"id":"AC-5.1","desc":"与障碍有效碰撞触发失败","code":["src/logic/collision.js:checkCollision","src/logic/world.js:World.update"],"tests":["src/logic.test.js"],"status":"done"},
  {"id":"AC-5.2","desc":"路口未转向冲出赛道失败","code":["src/logic/world.js:World.update","src/logic/world.js:World._gameOver"],"tests":["src/logic/turns.test.js"],"status":"done"},
  {"id":"AC-5.3","desc":"碰撞判定与画面一致（纵向判定带）","code":["src/logic/collision.js:checkCollision","src/render/pools.js:WorldView._buildTile"],"tests":["src/logic/turns.test.js"],"status":"done"},
  {"id":"AC-5.4","desc":"跳跃临界越障（恰达 JUMP_CLEAR）","code":["src/logic/collision.js:checkCollision","src/config.js:JUMP_CLEAR"],"tests":["src/logic/turns.test.js"],"status":"done"},
  {"id":"AC-5.5","desc":"滑铲临界过高障","code":["src/logic/collision.js:checkCollision"],"tests":["src/logic.test.js"],"status":"done"},
  {"id":"AC-6.1","desc":"经过金币自动收集并即时更新计数","code":["src/logic/collision.js:collectCoins","src/logic/world.js:World.update","src/render/pools.js:WorldView.sync"],"tests":["src/logic.test.js","src/logic/turns.test.js"],"status":"done"},
  {"id":"AC-6.2","desc":"实时显示距离/分数/金币","code":["src/ui/ui.js:UI.updateHUD","src/main.js:render"],"tests":[],"status":"partial"},
  {"id":"AC-6.3","desc":"结束展示最终成绩","code":["src/ui/ui.js:UI.showOver","src/main.js:endRun"],"tests":[],"status":"partial"},
  {"id":"AC-6.4","desc":"本地保存并展示历史最高分，刷新纪录提示","code":["src/platform/storage.js:getBest","src/platform/storage.js:setBest","src/main.js:endRun","src/ui/ui.js:UI.showOver"],"tests":["src/platform/storage.test.js"],"status":"done"},
  {"id":"AC-6.6","desc":"首次无历史最高分初值0，任意正分即新纪录","code":["src/platform/storage.js:getBest","src/main.js:endRun"],"tests":["src/platform/storage.test.js"],"status":"done"},
  {"id":"AC-7.1","desc":"结算界面要素完整含结束原因","code":["src/ui/ui.js:UI.showOver","index.html:#over"],"tests":["src/core/state.test.js"],"status":"done"},
  {"id":"AC-7.2","desc":"一键重开不刷新页面","code":["src/main.js:doStart","src/core/state.js:GameStateMachine.start","src/core/state.js:GameStateMachine.restart"],"tests":["src/core/state.test.js"],"status":"done"},
  {"id":"AC-7.3","desc":"重开后状态完全复位无残留","code":["src/logic/world.js:World.reset","src/render/pools.js:WorldView.reset","src/render/character.js:Runner.reset"],"tests":["src/logic.test.js","src/core/state.test.js"],"status":"done"},
  {"id":"AC-8.1","desc":"手动暂停停止运动并暂停输入","code":["src/main.js:doPause","src/core/state.js:GameStateMachine.pause","src/main.js:update"],"tests":["src/core/state.test.js"],"status":"done"},
  {"id":"AC-8.2","desc":"恢复后从暂停点继续状态一致","code":["src/main.js:doResume","src/core/state.js:GameStateMachine.resume"],"tests":["src/core/state.test.js"],"status":"done"},
  {"id":"AC-8.3","desc":"切后台/失焦自动暂停，回前台保持暂停","code":["src/main.js:buildControls"],"tests":[],"status":"partial"},
  {"id":"AC-8.6","desc":"暂停/结束时不响应游戏输入","code":["src/main.js:update","src/logic/world.js:World.applyIntent"],"tests":["src/logic/turns.test.js","src/core/state.test.js"],"status":"done"},
  {"id":"AC-9.1","desc":"3D场景/角色含光照阴影材质","code":["src/render/scene.js:SceneManager","src/render/character.js:Runner","src/render/pools.js:WorldView"],"tests":[],"status":"partial"},
  {"id":"AC-9.2","desc":"关键动作有动画/特效反馈","code":["src/render/pools.js:WorldView.coinBurst","src/render/pools.js:WorldView.crash","src/render/scene.js:SceneManager.shake","src/ui/ui.js:UI.flash","src/platform/audio.js:sfx","src/main.js:handleEvent"],"tests":[],"status":"partial"},
  {"id":"AC-9.3","desc":"UI风格统一随分辨率响应不变形","code":["index.html","src/main.js:resizeAll","src/render/scene.js:SceneManager.resize"],"tests":[],"status":"partial"},
  {"id":"NFR-1","desc":"高/低端设备稳定帧率无频繁卡顿","code":["src/core/loop.js:GameLoop","src/render/quality.js:QualityController.autoTune"],"tests":["src/core/loop.test.js","src/render/quality.test.js"],"status":"partial"},
  {"id":"NFR-2","desc":"首屏可玩≤5s，渐进加载+进度提示+缓存","code":["src/main.js:boot","src/platform/telemetry.js:markLoadDone","serve.js"],"tests":["src/platform/storage.test.js"],"status":"partial"},
  {"id":"NFR-3","desc":"输入到响应≤100ms跟手无丢输入","code":["src/core/loop.js:GameLoop","src/input/input.js:InputManager.poll","src/config.js:FIXED_DT"],"tests":["src/core/loop.test.js","src/input/input.test.js"],"status":"partial"},
  {"id":"NFR-4","desc":"主流浏览器+键盘/触摸+响应式+WebGL降级提示","code":["src/main.js:webglOK","src/main.js:resizeAll","src/input/input.js","index.html:#warn"],"tests":[],"status":"partial"},
  {"id":"NFR-5","desc":"画质分级+自动/手动降档保帧率","code":["src/render/quality.js:QualityController","src/render/scene.js:SceneManager.setQuality","src/render/pools.js:WorldView.setQuality","src/platform/storage.js:getSettings"],"tests":["src/render/quality.test.js","src/platform/storage.test.js"],"status":"done"},
  {"id":"NFR-6","desc":"纯前端不收集PII，最高分仅本地，HTTPS","code":["src/platform/storage.js","serve.js"],"tests":["src/platform/storage.test.js"],"status":"partial"},
  {"id":"NFR-7","desc":"FPS/加载耗时/JS错误可观测与捕获","code":["src/platform/telemetry.js:createFpsMeter","src/platform/telemetry.js:markLoadDone","src/platform/telemetry.js:installErrorCapture","src/ui/ui.js:UI.setFps"],"tests":["src/platform/storage.test.js"],"status":"done"},
  {"id":"NFR-8","desc":"长时间不崩溃不内存溢出，资源失败兜底","code":["src/logic/track.js:TrackGenerator.recycleBehind","src/render/pools.js:WorldView","src/platform/storage.js","src/main.js:boot"],"tests":["src/logic.test.js","src/platform/storage.test.js"],"status":"partial"}
]
```
