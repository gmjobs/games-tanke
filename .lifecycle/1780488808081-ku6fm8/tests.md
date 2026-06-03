<!-- 单元测试已写入工作区：神庙逃亡 -->

全部通过。`npm test`（vitest）共 **67 个用例、7 个测试文件全绿**。

## 总结

我先通读了实际代码（`config.js`、`logic/`、`core/`、`input/`、`platform/`、`render/`），贴着真实接口与已评审技术方案编写测试。项目已有 `src/logic.test.js`（16 例，覆盖速度曲线/计分/可行性/碰撞/世界推进），我**保留不动**，新增 5 个测试文件补齐此前未覆盖的模块与边界路径：

| 新增测试文件 | 被测模块 | 覆盖要点（关联 AC/NFR） |
|---|---|---|
| `src/core/state.test.js` (9) | `GameStateMachine` | 相位流转、就绪前禁开始 AC-1.2/1.3、暂停恢复 AC-8.1/8.2、非法转移屏蔽 AC-8.6、失败带原因、一键重开 AC-7.2/7.3、onEnter 钩子 |
| `src/core/loop.test.js` (6) | `GameLoop` | 固定步长累加 NFR-1/3、插值因子 alpha∈[0,1)、帧时限幅 + 步数封顶（防螺旋死亡）、onFrame 帧时长、stop 止损、跨帧余量保留 |
| `src/logic/turns.test.js` (11) | `World` + `collision` | 用「可控假赛道」隔离路口逻辑：转向提示+自动回中、按对方向武装安全通过 AC-3.1、漏转/反向→冲出赛道 AC-3.7/5.2、滑铲计时恢复、无二段跳 AC-3.10、滑铲中按跳互斥 AC-3.5、over 后输入屏蔽、矮栏临界/判定带/弧形金币 AC-5.3/5.4/6.1 |
| `src/render/quality.test.js` (8) | `QualityController` | 默认高画质、apply 透传 scene/view、setUser 上限、持续低帧降档与迟滞、偶发低帧不抖动、持续高帧回升、用户锁 low 不回升、auto 关闭不变 NFR-5 |
| `src/platform/storage.test.js` (11) | `storage` + `telemetry` | 最高分初值 0/向下取整/持久化/损坏数据回退 AC-6.4/6.6、设置默认与往返、隐私模式抛错兜底 NFR-6/8、FPS 滑动平均与加载耗时 NFR-7 |
| `src/input/input.test.js` (6) | `InputManager` | jump/slide 互斥取最新、同帧冲突单一结果、左右序列保留+竖向置尾、poll 取出清空+onAnyInput、reset AC-3.4/3.5 |

**方法说明**：纯逻辑模块（state/loop/world/track/collision/quality/config）直接在 Node 下运行；对依赖浏览器全局的模块（storage 的 `localStorage`、input 的 `window/document`）用内存桩/最小 DOM 桩注入，循环主体通过直接驱动 `_tick(now)` 与注入假 `track`/`scene`/`view` 来获得确定性，无需 jsdom，可被 `npm test` 直接跑通。

注：渲染观感（3D 光影、特效）、真实帧率达标、首屏加载时长、多浏览器兼容等属端到端/黑盒验收范畴，不在单元/集成测试可断言范围内，已通过逻辑层（速度曲线、画质降档、FPS 采样、加载耗时记录）做了可测面的代理覆盖。
