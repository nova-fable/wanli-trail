# 重构进行中的共享契约（所有迁移必须遵守）

> 本文件是重构期间全体协作者的唯一对接面。**任何与本文件不符的写法以本文件为准**；
> 需要变更契约时先改本文件再改代码。重构完成后本文件被 docs/dev/* 吸收并删除。

## 0. 铁律：先搬后改

- **搬移批次只做"位置 + import 路径"改动**：不重命名符号（除非本文件明确写了新名）、
  不改行为、不改字符串、不调顺序、不顺手"优化"。
- **改动批次**（去重/键化/新增）只做本文件列出的项。
- 同一文件同一时间只允许一个 owner 写；跨文件依赖改动必须先在任务里声明。

## 1. 目标目录布局（最终态）

```text
src/
  main.js                     应用挂载
  App.vue                     路由装配层
  router/index.js             hash 路由（ROUTES 枚举）
  mock/                       史实数据仓库（唯一单源，barrel 见 mock/index.js）
    index.js  README.md       入口与使用契约
    events/                   index.js(装配) catalog.js(目录契约) n25/red-first/red-fourth/red-second.js
    situation/                index.js zones.js blockades.js units.js japan.js
    routes/ armies.js figures.js strength.js phases.js quotes.js rivers.js stories.js
  core/
    constants/                icons.js playback.js history.js layers.js ui.js storage.js
    enums/                    index.js（UI 枚举单源）
    i18n/                     index.js zhCN.js en.js
  utils/
    geo.js                    barrel：位置/时间/地理（唯一对外入口）
    format.js                 「长征第 N 天」等展示格式化
    color.js                  颜色换算（随组件去重批次落地）
    date.js                   （可选）时间窗工具；不建则 geo 保持现名导出
  map/                        Leaflet 域模块（icons/camera/traveled/arrows/situation）
  composables/                usePlayback/useLayers/useMapBase/usePrefs/useTimeline/useFiguresIndex
  components/
    chrome/                   顶栏 / 帮助浮层 / 罗盘（Presentational）
    overlays/                 开场页 / 结语页 / 人物志 / 事件总览
    panels/                   事件讲解卡 / 图例
    layout/                   时间带 / 字幕条 / 氛围层
    SandboxMap.vue            地图编排容器
```

## 2. 依赖方向（单向，不得出现反向）

```text
components → composables → mock(数据) ─┐
     │                                  ├─→ utils → core(常量/枚举/i18n)
     └────────────→ map ────────────────┘
```

- `mock/` 与 `utils/` **禁止** import `components/` `composables/` `map/`。
- `mock/` 领域文件禁止 import 上层 barrel；跨域引用只允许在 **同一个目录的 index.js** 里装配。
- 组件只从 **barrel** 取数据：`import { EVENTS } from '../mock'`；
  唯一例外是 `map/situation.js` 路由，它需要按类索引，允许 `from '../mock/situation'`。
- `core/` 之下不得 import `utils/` 与 `mock/`。

## 3. 关键符号表（搬移后的唯一权威名）

| 符号 | 定义位置 | 备注 |
|---|---|---|
| `MAP_VIEW` | `core/constants/map.js` | 原 `CHINA_BOUNDS` 改名（含 CHINA_BOUNDS/VIEW_RESERVE/NARROW_BREAKPOINT） |
| `TRAVEL` | `core/constants/map.js` | 吸收原 `TRAVEL_TAIL_EPS` |
| `ARROWS` | `core/constants/map.js` | 吸收原 `ARROW_STEP`/`ARROW_DENSE_ZOOM`（组件取 `.STEP/.DENSE_ZOOM`） |
| `EV_SHAPES` | `core/constants/icons.js` | 从 `map/icons.js` 迁出；`map/icons.js` 以 `export { EV_SHAPES } from ...` 兼容转出 |
| `WALKER_ICON` | `core/constants/icons.js` | 原 map/icons.js 内的 iconSize/anchor 魔法数 |
| `FOLLOW` | `core/constants/playback.js` | `FOLLOW_ZOOMS` / `PLAYBACK` 并入（组件取 `FOLLOW.ZOOMS`） |
| `EVENT_INDEX` | `core/constants/history.js` | 原 `IntroOverlay` 里的会师星标事件 id 清单 |
| `HEX` | `utils/color.js` | `hexToRgb` / `withAlpha` / `isLightHex` |
| `ANIM`/`FALLBACKS` | `core/constants/ui.js` | 动画时长、兜底超时、断点等跨模块 UI 约定 |

改名映射（批量替换表，供各 owner 使用）：

| 旧 | 新 |
|---|---|
| `CHINA_BOUNDS` | `MAP_VIEW.CHINA_BOUNDS` |
| `VIEW_RESERVE` | `MAP_VIEW.RESERVE` |
| `NARROW_BREAKPOINT` | `MAP_VIEW.NARROW_BREAKPOINT` |
| `TRAVEL_TAIL_EPS` | `TRAVEL.TAIL_EPS` |
| `ARROW_STEP`/`ARROW_DENSE_ZOOM` | `ARROWS.STEP`/`ARROWS.DENSE_ZOOM` |
| `FOLLOW_ZOOMS` | `FOLLOW.ZOOMS` |
| `PLAYBACK` | `PLAYBACK`（不变） |
| `PREFS_KEY` | `STORAGE.PREFS` |

## 4. i18n 契约（键化批次）

- 所有 UI chrome 文案必须走 `t()`；史实内容（事件/人物/诗词/故事/态势描述）**保持中文不键化**。
- 已确定新增键名（中文值见各组件现状，英文由 i18n owner 补）：

| 键 | 用途 |
|---|---|
| `army.all` | 「多路红军主力」（EventPanel） |
| `army.multi` | 图例/地图中的多路主力（如需要） |
| `tl.continuous.short` | 时间带连播按钮（已存在 `tl.continuous`，复用即可） |
| `close` | 通用关闭按钮 title（EventIndex/FiguresPanel 硬编码「关闭」） |
| `ci.prev` `ci.next` | 事件讲解卡上/下一条（EventPanel 硬编码「◂ 上一事件」） |
| `legend.armies` | 图例标题（已存在于词典，组件需改用 `t('legend.armies')`） |
| `finale.explore` | 结语页「自由探索」（键已存在，组件硬编码需替换） |
| `finale.btn.spirit` | 顶栏「★ 长征精神」按钮（`pill.finale` 已存在，复用） |
| `intro.title` | 开场页主标题「红军长征」（与 `app.title` 区分：主视觉大标题） |
| `boot.*` | index.html 启动屏文案（`boot.loading` 等，仅引擎侧字典，不在 Vue 模板） |

- 时间轴/索引面板的**史实标签**（事件名、dateLabel、部队名）不键化。
- 数值常量（`4`/`14`/`761`）从数据推导，禁止硬编码：路数 = `ARMIES.length`，
  省数 = 四路 `provinces` 去重并集，天数 = `T_END - T_START` 折算。

## 5. CSS 拆分契约

- **唯一入口**：`src/styles/global.css` 只保留 `@import` 清单（保持 `main.js` 不改）。
- **导入顺序即层叠顺序**（低优先级在前），顺序固定：

  ```text
  1. tokens.css        设计 token（:root）+ reset
  2. base.css          滚动条/无障碍/通用按钮/leaflet 基础覆盖
  3. map.css           地图容器/底图滤镜/羊皮纸/罗盘/比例尺/路线/标记/小红军/箭头
  4. panel-legend.css  图例面板
  5. panel-event.css   事件讲解卡 + 帮助卡 + 字幕 + 氛围层
  6. timeline.css      底部时间带 + 悬停预览
  7. panel-index.css   事件总览 + 人物志 + 通用浮层
  8. intro.css         开场页（含自身 @media）
  9. finale.css        结语页（含自身 @media）
  10. responsive.css   全局窄屏 @media（顶层，必须最后）
  ```

- 每段搬移 **逐字保留**声明块与注释；只允许改：文件头注释、段界限。
- 判定为死代码并删除（已核）：`.tl-day`、`.btn-ghost`、`@keyframes intro-in` 如无引用。
  **删除项必须在本文件登记**，禁止各自静默删除。

## 6. 验收口径（缺一不可）

1. `npm run build` 全绿。
2. `dist/assets/*.css` 与基线 `/tmp/base-dist/assets/index-25qaLgTA.css`
   **内容逐字相同**（任意 CSS 拆分改动都不得改变产物）：
   `diff <(cat dist/assets/index-*.css) /tmp/base-dist/assets/index-25qaLgTA.css`
3. JS 允许哈希变化；但**符号存在性探针**必须全部为 1（证明没有被 tree-shake 掉）：

   ```bash
   for s in 行军中 长征第 多路红军主力 上一事件 自由探索 长征精神; do
     printf "%-14s %s\n" "$s" "$(grep -c "$s" dist/assets/index-*.js)"
   done
   ```
4. 数据搬运零丢失：事件 57 条、态势 28 条、人物 22 位、诗词 7 条、阶段 15 条、
   江河 10 条、精神印记 8 条、路线航点四路合计不变。
5. 运行时冒烟：`npm run preview` 后依次打开 `#/intro`、`#/sandbox`，无控制台报错（Lead 执行）。

## 7. 已知踩坑（不要重复踩）

- **`src/mock/events.js` 与 `src/mock/events/` 同名会遮蔽**：Vite/Rollup 下
  `./events` 解析到**文件**而非目录，导致 barrel 自引用。故装配层命名为
  `mock/events/index.js`，目录契约清单为 `mock/events/catalog.js`。
- **`playback.markerMode` 等 live binding**：不要对 barrel 里的可变导出做本地缓存，
  一律 `playback.xxx` 现取。
- **CSS 类名匹配要用词边界**：`grep -c '\.tl-ev\b'` 会把 `.tl-ev-card` 误判为命中；
  判定死代码必须用 `grep -E '\.tl-day([^a-z-]|$)'` 这类边界写法。
- **`fileReader`/注释里的旧路径**：搬移后 grep 全仓 `src/data`，注释也要改。
- 播放热路径（每 50ms）禁止在 `render()` 里新建大数组/对象；重构不得引入新的每帧分配。
