<!-- 追溯映射：坦克大战豪华版 -->

# 坦克大战豪华版 —— 需求追溯映射（RTM）

> 工作区已读取：`index.html`、`src/logic.js`（逻辑层/单一事实来源）、`src/game.js`（引擎层）、`src/logic.test.js`（单测，仅覆盖逻辑层）。
> **关键事实**：自动化单测 **只覆盖 `src/logic.js`**（纯逻辑：常量/地形/碰撞/计分/关卡/地图生成）。引擎层 `src/game.js`（AI、渲染、音频、HUD、持久化、状态机、输入）**无自动化测试**，仅靠验收文档 AT-xx 手动验收。这是本工程最主要的测试缺口。

## 一、功能需求映射

| 编号(AC/功能) | 业务释义 | 实现代码(文件:函数/类) | 对应测试 | 状态 |
|---|---|---|---|---|
| **AC-1.1** | 加载即见主菜单（开始/模式/设置/最高分/帮助） | `index.html:107-118`(#ovMenu/#mainMenu)；`src/game.js:613`(refreshMenu/resetSel 初始化) | 无（手动 AT-A1） | 已实现 |
| **AC-1.2** | 子界面可进入且可返回主菜单 | `src/game.js:528-537`(mainMenu点击路由)、`:542-548`(backMenu/refreshMenu)、`:427`(showOnly) | 无（手动 AT-A2） | 已实现 |
| **AC-1.3** | 鼠标点击 + 键盘(方向键+回车)双导航 | 键盘：`src/game.js:511-525`(menuNav/curMenu/highlight)、`:495`(state≠playing时menuNav)；鼠标：`index.html:41`(.btn:hover) + 各按钮click | 无（手动 AT-A3/A4） | 已实现 |
| **AC-2.1** | 26×26 网格、玩家/≥2敌人出生点、受保护基地 | `src/logic.js:15`(COLS/ROWS)、`:45`(SPAWN_COLS 3处)、`:69-96`(buildMap/base/FORT)；玩家出生 `src/game.js:110-112` | `logic.test.js:9-17`、`:108-128`(地图/基地/出生区) | 已实现 |
| **AC-2.2** | ≥4种地形（砖/钢/草/水）外观可分、行为各异 | `src/logic.js:21`(枚举)、`:84`(palette)；渲染 `src/game.js:351-365`(砖/钢/水)、`:389-394`(草丛覆盖层) | `logic.test.js:31-45`(solid规则) | 已实现 |
| **AC-2.3** | 坦克阻挡砖/钢/水；子弹削砖、打钢无效、穿草/水 | 坦克：`src/logic.js:99`(tileSolidForTank)、`:110-128`(tankBlocked)；子弹：`:102`(tileSolidForBullet)、`src/game.js:226-238`(砖→空/钢无效/草水穿) | `logic.test.js:31-45`、`:54-70` | 已实现 |
| **AC-3.1** | P1=方向键+空格、P2=WASD+F；按键可在帮助查看 | `src/game.js:181-191`(P1/P2按键分支)；说明 `index.html:152-163`(#ovHelp) | 无（手动 AT-C1/C2/C3） | 已实现 |
| **AC-3.2** | 仅四向移动，朝向随移动改变 | `src/game.js:145-155`(moveTank，转向对齐网格+设dir) | 无（手动 AT-C4） | 已实现 |
| **AC-3.3** | 子弹沿朝向直线；同屏子弹上限(默认1，火力提升) | `src/game.js:156-167`(fire，maxBullets判定)、`:219-224`(子弹直线步进)；火力提升 `:328`(maxBullets=2) | 无（手动 AT-C5/C6） | 已实现 |
| **AC-3.4** | 速度按时间步长，帧率无关 | `src/game.js:21`(FIXED_DT)、`:478-487`(固定步长循环+250ms钳制)、`:151`(speed*dt) | 间接（FIXED_DT 常量逻辑确定性）；**无帧率无关专项测试** | 已实现（注：render未做插值，仅按固定逻辑步长保证速度一致） |
| **AC-4.1** | 每关固定数量(默认~20)、同屏上限(默认4) | `src/logic.js:57`(total≈20-28)、`:18`(MAX_ENEMY_SCREEN)；`src/game.js:121-122`(上限闸)、`:282-284`(持续刷怪) | `logic.test.js:90-96`(总数范围)、`:10-17`(上限常量) | 已实现 |
| **AC-4.2** | ≥3种敌人(普通/快速/装甲)属性各异 | `src/logic.js:24-28`(ENEMY_TYPES)、`:134-138`(pickEnemyType)；选型 `src/game.js:123-124` | `logic.test.js:22-28`、`:99-105` | 已实现 |
| **AC-4.3** | 敌方AI自动移动/转向/射击、趋向基地 | `src/game.js:199-216`(AI：探障转向、加权趋向基地权重、定时射击) | 无（手动 AT-D3） | 已实现 |
| **AC-4.4** | 部分「闪烁/红色」敌人被击毁掉道具 | `src/game.js:133-134`(flash标记)、`:300`(掉落)、`:318-324`(dropPower)；闪烁渲染 `:384` | 无（手动 AT-D4） | 已实现 |
| **AC-5.1** | 子弹命中敌→扣血/毁/计分；命中玩家→受损/损命 | `src/game.js:253-260`(命中分派)、`:293-304`(hitEnemy计分)、`:305-315`(hitPlayer损命) | 计分逻辑 `logic.test.js:72-79`(scoreForKill)；命中判定本身无单测 | 已实现 |
| **AC-5.2** | 敌我子弹相撞双方抵消 | `src/game.js:247-252`(isPlayer不同且overlap→双删) | AABB `logic.test.js:47-52`(rectsOverlap)；抵消流程无单测 | 已实现 |
| **AC-5.3** | 基地被任意子弹命中即游戏结束 | `src/game.js:240-245`(基地命中→gameOver) | 无（手动 AT-E4） | 已实现 |
| **AC-5.4** | 坦克间不可重叠穿透 | `src/logic.js:122-127`(tankBlocked 含 others 重叠) | `logic.test.js:65-69` | 已实现 |
| **AC-6.1** | ≥6种道具(火/盾/炸/命/停/固)各效果 | `src/logic.js:31-38`(ITEM_TYPES)；效果 `src/game.js:325-344`(applyPower 全6种) | `logic.test.js:18-21`(恰6种)；效果逻辑无单测 | 已实现 |
| **AC-6.2** | 道具出现于战场、碰触触发、视/音反馈 | 放置 `src/game.js:318-324`；拾取 `:265-271`；反馈 `:326`(sfx'pick')、`:328+`(toast)、渲染 `:375-382` | 无（手动 AT-F2） | 已实现 |
| **AC-6.3** | 限时类有时长与到期提示、自动失效 | 火力 `src/game.js:176`、护盾 `:178`、定身 `:198`、加固 `:274-277`；时长在 `applyPower` toast 中提示 | 无（手动 AT-F5/F6/F7） | **部分**：到期/拾取有 toast 提示，但**无 HUD 实时倒计时**（技术方案提及的剩余时长显示未实现） |
| **AC-7.1** | ≥10关，各关独立地图与敌人配置 | `src/logic.js:18`(MAXLV=10)、`:54-66`(levelConfig)、`:69-96`(buildMap 按seed) | `logic.test.js:90-96`、`:108-128`(确定性/独立) | 已实现 |
| **AC-7.2** | 清场即过关、展示结算并进下一关 | `src/game.js:288`(过关判定)、`:438-451`(levelClear)、`:552`(btnNext) | 无（手动 AT-G1） | 已实现 |
| **AC-7.3** | 随关卡敌人数量/强度/地形递增 | `src/logic.js:54-66`(fastRatio/armorRatio/terrain/enemyFire/speedScale 随n升) | `logic.test.js:81-89` | 已实现 |
| **AC-7.4** | 通关最后一关展示「通关」结算 | `src/game.js:552`(level≥MAXLV→winGame)、`:464-475`(winGame，标题区别于失败) | 无（手动 AT-G3） | 已实现 |
| **AC-8.1** | 按类型计分；HUD实时显示分/命/关/剩余敌 | 计分 `src/logic.js:131`、`src/game.js:298-299`；HUD `:417-425`(updateHUD)、`index.html:98-104` | `logic.test.js:72-79`(计分)；HUD刷新无单测 | 已实现 |
| **AC-8.2** | 单关结束展示按类型击毁计数及得分 | `src/game.js:107`(killedThisLevel)、`:440-443`(clearStats普通/快速/装甲+得分) | 无（手动 AT-G1） | 已实现 |
| **AC-8.3** | 结束/通关展示总分、与最高比较、刷新提示 | `src/game.js:454-461`(gameOver)、`:466-473`(winGame)、新纪录 `:458-459`/`index.html:188` | 无（手动 AT-G2/G5） | 已实现 |
| **AC-9.1** | Esc/P 暂停、逻辑冻结、显示遮罩 | `src/game.js:496-499`(切换paused)、`:482`(仅playing步进逻辑)、`index.html:166-173`(#ovPause) | 无（手动 AT-H1/H3） | 已实现 |
| **AC-9.2** | 暂停界面「继续/重开/返回菜单」 | `src/game.js:549-551`(btnResume/btnRestart/btnQuit)、`index.html:168-172` | 无（手动 AT-H2） | 已实现 |
| **AC-9.3** | 失焦自动暂停 | `src/game.js:508`(blur)、`:509`(visibilitychange)、`:481`(250ms钳制防暴走) | 无（手动 AT-H4） | 已实现 |
| **AC-10.1** | 双人同屏两坦克、两套独立按键 | `src/game.js:112`(P2生成)、`:181-191`(独立按键)；HUD P2 `:420-421`/`index.html:100` | 无（手动 AT-I1） | 已实现 |
| **AC-10.2** | 单玩家阵亡退出本局；双败/基地毁则结束 | `src/game.js:308`(lives<0→alive=false)、`:287`(无存活玩家→gameOver)、`:240-244`(基地毁) | 无（手动 AT-I2/I3） | 已实现 |
| **AC-10.3** | 分别记录两名玩家得分 | `src/game.js:298`(b.owner.score+=)、HUD `:419-421`(hS1/hS2分块) | 无（手动 AT-I4） | 已实现 |
| **AC-11.1** | BGM + 关键音效(射击/爆炸/拾取/过关/失败) | `src/game.js:40-55`(sfx 各type)、`:56-69`(bgmOn/Off)；调用点 shoot/boom/pick/level/over | 无（手动 AT-J1） | 已实现 |
| **AC-11.2** | 爆炸特效；BGM/SFX 可独立开关 | 爆炸 `src/game.js:291`(boom)、`:396-400`(渲染)；开关 `:563-564`(swBgm/swSfx独立) | 无（手动 AT-J2/J3） | 已实现 |
| **AC-11.3** | 音量/开关设置持久化 | `src/game.js:28`(DEFAULTS bgm/sfx)、`:31`(persist)、`:563-564`(切换即存) | 无（手动 AT-J4） | **部分**：开关持久化已实现，但**仅有开/关，无音量调节**（规格「音量」未实现） |
| **AC-12.1** | 最高分写 localStorage 跨会话保留 | `src/game.js:27-31`(KEY/load/persist)、`:458/470`(写high)、`:444-449`(过关同步) | 无（手动 AT-K1） | 已实现 |
| **AC-12.2** | 存在存档时显示「继续游戏」并续关 | `src/game.js:546-547`(refreshMenu显示)、`:92-97`(newGame读save)、`:532`(continue) | 无（手动 AT-K2/A5） | 已实现 |
| **AC-12.3** | 清数据后重置且不报错 | `src/game.js:30`(load try/catch)、`:31`(persist try/catch)、`:571-575`(resetData) | 无（手动 AT-K3）；解析容错逻辑无单测 | 已实现 |

## 二、非功能需求映射

| 编号 | 业务释义 | 实现代码(文件:函数/类) | 对应测试 | 状态 |
|---|---|---|---|---|
| **AC-NFR-1.1** | 帧率 ≥60/30 FPS | `src/game.js:478-487`(固定步长+渲染解耦)、`:481`(钳制) | 无（需手动性能测） | **部分**（实现到位，无自动化性能验证） |
| **AC-NFR-1.2** | 首屏 ≤3s、资源 ≤5MB | 纯前端零外部资源：`index.html`内联CSS、WebAudio程序化合成 `src/game.js:40-67`(无音频文件) | 无 | 已实现（结构满足，无自动化测） |
| **AC-NFR-1.3** | 输入延迟 ≤50ms | 直读 keys/触屏 `src/game.js:171-195` | 无 | **部分**（无延迟测量） |
| **AC-NFR-2.1** | 支持 Chrome/Edge/Firefox/Safari | 经典脚本IIFE、标准API、`webkitAudioContext`回退 `src/game.js:36` | 无（需跨浏览器手动） | **部分** |
| **AC-NFR-2.2** | 桌面键盘 + 平板触屏；自适应 ≥1024×768 | 触屏 `src/game.js:582-595`、`index.html:200-206`；自适应 `index.html:16`(max-width)、`:23`(aspect-ratio) | 无（手动 AT-L） | 已实现 |
| **AC-NFR-2.3** | 纯前端无后端 | 单文件 file:// 可运行，`src/game.js:8`注释；无网络调用 | 无 | 已实现 |
| **AC-NFR-3.1** | 不收集PII，本地仅存分数/设置 | `src/game.js:28`(SaveData仅high/highLv/save/bgm/sfx/touch/mode) | 无 | 已实现 |
| **AC-NFR-3.2** | HTTPS、无eval、依赖无高危 | 全代码无 `eval`/`Function` 构造 | 无；HTTPS属部署 | **部分**（代码层满足；HTTPS需部署保障） |
| **AC-NFR-4.1** | 关键事件输出控制台/可选埋点 | —— | 无 | **缺失**：仅捕获异常，**未对 开始/过关/失败 等关键事件做 console 输出或埋点** |
| **AC-NFR-4.2** | 运行异常友好提示不白屏 | `src/game.js:14`、`:604-610`(showFatal/error/unhandledrejection)、`index.html:80-83`(.errbar) | 无 | 已实现 |
| **AC-NFR-5.1** | 关卡/敌人/道具数据配置化 | `src/logic.js:24-66`(ENEMY_TYPES/ITEM_TYPES/levelConfig 全数据驱动) | `logic.test.js:81-96`(配置可测) | 已实现 |
| **AC-NFR-5.2** | 首次进入操作说明/新手提示 | 帮助页 `index.html:152-163`、菜单提示文案 `:109` | 无 | **部分**：有帮助页与菜单提示，但**无「首次进入」自动弹出新手提示** |
| **AC-NFR-5.3** | 模块分层、核心逻辑单测覆盖 | 逻辑层 `src/logic.js`（纯函数）/引擎层 `src/game.js`（IO）分离 | `logic.test.js`(16用例)覆盖逻辑层 | 已实现（注：单测仅覆盖逻辑层，引擎层无单测） |

## 三、评审修订映射

| 编号 | 业务释义 | 实现代码 | 对应测试 | 状态 |
|---|---|---|---|---|
| **评审修订(2026/6/3)** / **AT-G2** | 游戏结束结算分数相对原型再放大 2 个字号 | `index.html:48`(.big-score 64px) → `index.html:50-51`(.over-score 88px)；DOM `index.html:187`(class="big-score over-score") | 无（手动 AT-G2，需肉眼核对字号） | 已实现（64px→88px） |

## 四、缺口汇总（明确指出）

1. **测试覆盖缺口（最重要）**：自动化单测仅覆盖 `src/logic.js`（16 用例）。`src/game.js` 全部引擎行为——敌人 AI、子弹/坦克命中分派、道具效果 `applyPower`、双人计分、暂停/失焦、持久化容错、HUD——**无任何自动化测试**，全依赖手动验收 AT-xx。`hitEnemy`/`hitPlayer`/`applyPower`/`spawnEnemy` 这类含分支的引擎函数因强耦合 DOM/全局状态而难以单测，是最大技术债。
2. **AC-NFR-4.1 关键事件可观测：缺失**。仅有全局异常捕获（`showFatal`），未对 开始/过关/失败/错误 做 console 输出或可关闭埋点。
3. **AC-6.3 限时道具倒计时：部分**。仅在拾取/到期时 toast，**无 HUD 实时剩余时长**（与技术方案 `HUD 显示剩余时长` 不符）。
4. **AC-11.3 音量持久化：部分**。仅 BGM/SFX 开关，无音量级别调节（规格的「音量」未实现）。
5. **AC-NFR-5.2 新手提示：部分**。有帮助页，但无首次进入自动引导。
6. **AC-3.4 渲染插值：未实现**。主循环 `loop` 调 `render()` 未传 alpha，`render()` 也不插值——速度按固定步长保持帧率无关（满足 AC-3.4），但技术方案描述的「插值渲染」未落地（低帧率下画面可能略顿，不影响逻辑正确性）。
7. **性能/兼容/HTTPS 类 NFR（1.1/1.3/2.1/3.2）**：代码结构满足，但**无自动化验证**，仅能手动/部署阶段确认。

```json
[
  {"id":"AC-1.1","desc":"加载即见主菜单(开始/模式/设置/最高分/帮助)","code":["index.html:#ovMenu","src/game.js:refreshMenu"],"tests":[],"status":"done"},
  {"id":"AC-1.2","desc":"子界面可进入且可返回主菜单","code":["src/game.js:backMenu","src/game.js:showOnly"],"tests":[],"status":"done"},
  {"id":"AC-1.3","desc":"鼠标点击+键盘方向键回车双导航","code":["src/game.js:menuNav","src/game.js:curMenu"],"tests":[],"status":"done"},
  {"id":"AC-2.1","desc":"26x26网格/≥2敌人出生点/受保护基地","code":["src/logic.js:buildMap","src/logic.js:SPAWN_COLS"],"tests":["src/logic.test.js:网格与常量","src/logic.test.js:地图生成"],"status":"done"},
  {"id":"AC-2.2","desc":"≥4种地形砖钢草水可区分","code":["src/logic.js:ITEM/枚举","src/game.js:render"],"tests":["src/logic.test.js:地形碰撞规则"],"status":"done"},
  {"id":"AC-2.3","desc":"地形碰撞:坦克阻挡/子弹削砖/钢无效/穿草水","code":["src/logic.js:tileSolidForTank","src/logic.js:tileSolidForBullet","src/game.js:step"],"tests":["src/logic.test.js:地形碰撞规则","src/logic.test.js:坦克移动阻挡"],"status":"done"},
  {"id":"AC-3.1","desc":"P1方向键空格/P2 WASD+F/帮助可查","code":["src/game.js:step","index.html:#ovHelp"],"tests":[],"status":"done"},
  {"id":"AC-3.2","desc":"四向移动朝向随移动改变","code":["src/game.js:moveTank"],"tests":[],"status":"done"},
  {"id":"AC-3.3","desc":"子弹直线+同屏上限(默认1,火力提升)","code":["src/game.js:fire","src/game.js:applyPower"],"tests":[],"status":"done"},
  {"id":"AC-3.4","desc":"按时间步长帧率无关(无插值)","code":["src/game.js:loop","src/game.js:FIXED_DT"],"tests":[],"status":"done"},
  {"id":"AC-4.1","desc":"每关固定数(~20)同屏上限4","code":["src/logic.js:levelConfig","src/game.js:spawnEnemy"],"tests":["src/logic.test.js:关卡难度递增"],"status":"done"},
  {"id":"AC-4.2","desc":"≥3种敌人类型属性各异","code":["src/logic.js:ENEMY_TYPES","src/logic.js:pickEnemyType"],"tests":["src/logic.test.js:网格与常量","src/logic.test.js:敌人类型选择"],"status":"done"},
  {"id":"AC-4.3","desc":"敌方AI移动转向射击趋向基地","code":["src/game.js:step"],"tests":[],"status":"done"},
  {"id":"AC-4.4","desc":"闪烁敌人击毁掉道具","code":["src/game.js:spawnEnemy","src/game.js:dropPower"],"tests":[],"status":"done"},
  {"id":"AC-5.1","desc":"命中敌扣血计分/命中玩家损命","code":["src/game.js:hitEnemy","src/game.js:hitPlayer"],"tests":["src/logic.test.js:计分"],"status":"done"},
  {"id":"AC-5.2","desc":"敌我子弹相撞抵消","code":["src/game.js:step"],"tests":["src/logic.test.js:AABB相交"],"status":"done"},
  {"id":"AC-5.3","desc":"基地被子弹命中即失败","code":["src/game.js:step","src/game.js:gameOver"],"tests":[],"status":"done"},
  {"id":"AC-5.4","desc":"坦克间不可重叠穿透","code":["src/logic.js:tankBlocked"],"tests":["src/logic.test.js:坦克移动阻挡"],"status":"done"},
  {"id":"AC-6.1","desc":"≥6种道具及效果","code":["src/logic.js:ITEM_TYPES","src/game.js:applyPower"],"tests":["src/logic.test.js:网格与常量"],"status":"done"},
  {"id":"AC-6.2","desc":"道具碰触触发+视音反馈","code":["src/game.js:step","src/game.js:dropPower"],"tests":[],"status":"done"},
  {"id":"AC-6.3","desc":"限时道具时长与到期提示自动失效","code":["src/game.js:step","src/game.js:applyPower"],"tests":[],"status":"partial"},
  {"id":"AC-7.1","desc":"≥10关各关独立地图敌配","code":["src/logic.js:levelConfig","src/logic.js:buildMap"],"tests":["src/logic.test.js:地图生成","src/logic.test.js:关卡难度递增"],"status":"done"},
  {"id":"AC-7.2","desc":"清场过关展示结算进下一关","code":["src/game.js:levelClear","src/game.js:btnNext"],"tests":[],"status":"done"},
  {"id":"AC-7.3","desc":"随关卡难度递增","code":["src/logic.js:levelConfig"],"tests":["src/logic.test.js:关卡难度递增"],"status":"done"},
  {"id":"AC-7.4","desc":"通关展示通关结算","code":["src/game.js:winGame"],"tests":[],"status":"done"},
  {"id":"AC-8.1","desc":"按类型计分+HUD实时显示","code":["src/logic.js:scoreForKill","src/game.js:updateHUD"],"tests":["src/logic.test.js:计分"],"status":"done"},
  {"id":"AC-8.2","desc":"单关按类型击毁计数及得分","code":["src/game.js:levelClear"],"tests":[],"status":"done"},
  {"id":"AC-8.3","desc":"结束/通关总分与最高比较刷新提示","code":["src/game.js:gameOver","src/game.js:winGame"],"tests":[],"status":"done"},
  {"id":"AC-9.1","desc":"Esc/P暂停逻辑冻结遮罩","code":["src/game.js:setState","src/game.js:loop"],"tests":[],"status":"done"},
  {"id":"AC-9.2","desc":"暂停界面继续/重开/返回菜单","code":["src/game.js:btnResume","src/game.js:btnRestart","src/game.js:btnQuit"],"tests":[],"status":"done"},
  {"id":"AC-9.3","desc":"失焦自动暂停","code":["src/game.js:blur","src/game.js:visibilitychange"],"tests":[],"status":"done"},
  {"id":"AC-10.1","desc":"双人同屏两坦克独立按键","code":["src/game.js:startLevel","src/game.js:step"],"tests":[],"status":"done"},
  {"id":"AC-10.2","desc":"单玩家阵亡退出/双败或基地毁结束","code":["src/game.js:hitPlayer","src/game.js:step"],"tests":[],"status":"done"},
  {"id":"AC-10.3","desc":"分别记录两玩家得分","code":["src/game.js:hitEnemy","src/game.js:updateHUD"],"tests":[],"status":"done"},
  {"id":"AC-11.1","desc":"BGM+关键音效","code":["src/game.js:sfx","src/game.js:bgmOn"],"tests":[],"status":"done"},
  {"id":"AC-11.2","desc":"爆炸特效+BGM/SFX独立开关","code":["src/game.js:boom","src/game.js:bindSwitch"],"tests":[],"status":"done"},
  {"id":"AC-11.3","desc":"音量/开关持久化(仅开关,无音量)","code":["src/game.js:persist","src/game.js:bindSwitch"],"tests":[],"status":"partial"},
  {"id":"AC-12.1","desc":"最高分localStorage跨会话","code":["src/game.js:persist","src/game.js:gameOver"],"tests":[],"status":"done"},
  {"id":"AC-12.2","desc":"存档时继续游戏续关","code":["src/game.js:newGame","src/game.js:refreshMenu"],"tests":[],"status":"done"},
  {"id":"AC-12.3","desc":"清数据后重置不报错","code":["src/game.js:resetData","src/game.js:persist"],"tests":[],"status":"done"},
  {"id":"AC-NFR-1.1","desc":"60/30FPS固定步长","code":["src/game.js:loop"],"tests":[],"status":"partial"},
  {"id":"AC-NFR-1.2","desc":"首屏≤3s资源≤5MB零外部资源","code":["index.html","src/game.js:sfx"],"tests":[],"status":"done"},
  {"id":"AC-NFR-1.3","desc":"输入延迟≤50ms","code":["src/game.js:step"],"tests":[],"status":"partial"},
  {"id":"AC-NFR-2.1","desc":"主流浏览器兼容","code":["src/game.js:audio"],"tests":[],"status":"partial"},
  {"id":"AC-NFR-2.2","desc":"键盘+触屏/自适应","code":["src/game.js:applyTouch","index.html:.touch"],"tests":[],"status":"done"},
  {"id":"AC-NFR-2.3","desc":"纯前端无后端","code":["src/game.js","index.html"],"tests":[],"status":"done"},
  {"id":"AC-NFR-3.1","desc":"不收集PII仅存分数设置","code":["src/game.js:DEFAULTS"],"tests":[],"status":"done"},
  {"id":"AC-NFR-3.2","desc":"无eval/HTTPS(部署)","code":["src/game.js"],"tests":[],"status":"partial"},
  {"id":"AC-NFR-4.1","desc":"关键事件console/埋点","code":[],"tests":[],"status":"missing"},
  {"id":"AC-NFR-4.2","desc":"异常友好提示不白屏","code":["src/game.js:showFatal"],"tests":[],"status":"done"},
  {"id":"AC-NFR-5.1","desc":"关卡/敌人/道具数据配置化","code":["src/logic.js:ENEMY_TYPES","src/logic.js:levelConfig"],"tests":["src/logic.test.js:关卡难度递增"],"status":"done"},
  {"id":"AC-NFR-5.2","desc":"首次进入新手提示","code":["index.html:#ovHelp"],"tests":[],"status":"partial"},
  {"id":"AC-NFR-5.3","desc":"模块分层+核心逻辑单测","code":["src/logic.js","src/game.js"],"tests":["src/logic.test.js"],"status":"done"},
  {"id":"REVIEW-2026-06-03","desc":"游戏结束结算分数再放大2字号(64→88px)","code":["index.html:.over-score","index.html:#overScore"],"tests":[],"status":"done"}
]
```
