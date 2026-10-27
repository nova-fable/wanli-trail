# 重构批次拆分（Lead 落地用）

> 与 [CONTRACT.md](CONTRACT.md) 配套：契约定义"改成什么样"，本文件定义"谁在哪个批次改哪几个文件"。
> **写范围互斥**：同一行里不允许两个 owner；跨 owner 的依赖必须走契约里的符号表。

## 批次总表

| # | 批次 | owner | 写范围（互斥） | 依赖 | 状态 |
|---|---|---|---|---|---|
| R0 | 契约 + 基线 + mock 骨架 | lead | `CONTRACT.md` `REFACTOR.md` `src/mock/**` 全部消费方 import 行 | — | 进行中 |
| R1 | 常量/枚举按域拆分 | 待定 | `src/core/constants/**` + 引用方 import 行 | R0 | 待办 |
| R2 | CSS 拆分（零改动的部分） | 待定 | `src/styles/**` | R0 | 待办 |
| R3 | 组件去重/键化（行为改动） | 待定 | `src/components/**` `src/App.vue` `src/core/i18n/**` | R1 R2 | 待办 |
| R4 | 文档同步 | lead | `docs/**` `AGENTS.md` `README.md` | R1-R3 | 待办 |

## R0 实际落地记录（已完成部分）

- `src/data/**` → `src/mock/**`（`git mv` 保历史）：routes/armies/figures/strength/rivers/stories/phases/quotes 平移；
  `events.js` 按部队切四个领域文件 + 装配层；`situation.js` 按四组实体切分 + 子 barrel。
- 全仓 `../data/*` import 收敛为 `from '../mock'`（barrel 单入口）。
- 数据搬运零丢失已用 AST 级比对验证（首版切分脚本对 `zones/units/blockades` 产生过重复声明行与多余 `]`，
  已在同一批次内修复；比对脚本确认 57 条事件与 28 条态势实体源码逐字一致）。
- 基线：`/tmp/base-dist`（CSS 50,225 B 逐字快照、JS 186,140 B）；验收脚本 `/tmp/verify.sh`。
- 产物：JS 161.19 kB → 161.28 kB（gzip 72.17 → 70.82 kB），CSS 与基线逐字相同。

## R1 常量/枚举拆分（明细）

写范围：`src/core/constants/{icons,playback,history,layers,ui}.js`（新增）、`map.js`、`storage.js`、`enums/index.js`、
以及 `src/map/icons.js` `src/map/camera.js` `src/map/traveled.js` `src/map/arrows.js` `src/composables/usePlayback.js`
`src/composables/usePrefs.js` `src/components/SandboxMap.vue` `src/components/IntroOverlay.vue` 的 **import 与常量引用行**。

改名映射见 CONTRACT.md §3。要求：

1. `map.js` 只留地图几何；`EV_SHAPES`/`WALKER_ICON` 进 `icons.js`；`FOLLOW_ZOOMS`/`PLAYBACK` 进 `playback.js`；
   `EVENT_INDEX`（四枚会师金星 id）进 `history.js`；`ui.js` 收跨模块 UI 约定（断点兜底、动画时长）。
2. `map/icons.js` 保留 `export { EV_SHAPES } from '../core/constants/icons'` 兼容转出，避免一次性改动面过大。
3. 禁止改任何数值；禁止改行为。
4. 自验：`npm run build` + `/tmp/verify.sh`（CSS 必须逐字不变，说明本批次没碰到样式）。

## R2 CSS 拆分（明细）

写范围：`src/styles/**`（`global.css` 改为 `@import` 清单 + 10 个分片文件）。

1. 按 CONTRACT.md §5 的固定顺序与归属逐字切分。
2. 删除项仅限：`.tl-day`、`.btn-ghost`（判定依据：模板/脚本全仓无引用；已用词边界 grep 复核）。
   `@keyframes intro-in` 仍被 `.intro-overlay` 使用，**保留**。
3. 自验：`/tmp/verify.sh` —— CSS 产物必须与基线逐字相同（含注释与顺序），
   因此**分片合并顺序必须与拆分前一致**；任何顺序变化都视为失败并回退。

## R3 组件去重/键化（明细，行为改动）

写范围：`src/components/**`、`src/App.vue`、`src/core/i18n/{zhCN,en}.js`、`src/index.html`（启动屏样式外置）。

1. `TimelineBar.vue` 的月份刻度/悬停逻辑抽到 `composables/useTimeline.js`（保持 50ms 热路径零新增分配）。
2. `EventPanel`/`EventIndex`/`ArmyLegend`/`FiguresPanel` 的重复派生（当前事件序号、类型元数据、时间窗筛选、
   部队色）收敛到 `mock/events.js` 的 `eventMeta`/`eventIndexOf` 与 `utils/format.js`。
3. 硬编码中文按 CONTRACT.md §4 键化；数值常量改为数据推导。
4. 新增 `components/chrome/`（顶栏拆分：`AppHeader.vue` + `HelpCard.vue`）与 `OverlayShell.vue` 通用浮层骨架。
5. 自验：`/tmp/verify.sh` —— CSS 产物仍必须与基线逐字相同（本批次只改组件与词典，
   `index.html` 启动屏样式外置会改变 HTML 内联样式，属预期，需在报告里注明差异）。
