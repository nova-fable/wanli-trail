# src/utils/ · 工具类归类索引

本目录只放**与业务无关的纯工具**：给定输入得到输出，不持有状态、不读数据仓库、不碰 DOM。

依赖方向（[CONTRACT.md](../../CONTRACT.md) §2）：

```text
components → composables → mock(数据) ─┐
     │                                  ├─→ utils → core(常量/枚举/i18n)
     └────────────→ map ────────────────┘
```

`utils/` **禁止** import `mock/` `composables/` `components/` `map/`。
需要数据的工具写成**接收数组/对象作首参的纯函数**，由调用方把数据传进来
（例：`armyColor(ARMIES, key)` 而不是在 utils 里 import `ARMIES`）。

## 文件一览

| 文件 | 一句话职责 | 导出 |
|---|---|---|
| `geo.js` | 位置/时间/地理 barrel：时间基元 + 球面几何 + 路线插值 | `DAY_MS` `parseDate` `endOfDay` `formatCnDate` `clamp` `haversineKm` `catmullRomDensify` `prepareRoute` `positionAt` |
| `date.js` | 时间窗判定与「长征第 N 天」 | `inWindow` `dayOfMarch` |
| `format.js` | 史实数据行 → 界面文案/展示对象 | `armyColor` `armyName` |

## 什么该放哪：判定规则

按顺序问三个问题，第一个命中即定：

1. **是算式，不是数据？** 只做数学换算（时间戳、弧度、距离），没有业务名词 → `geo.js`。
2. **是「时刻」还是「区间」？** 单点换算（`'YYYY-MM-DD'` → 时间戳）留 `geo.js`；
   区间判定与区间计数（时间窗、天数差）→ `date.js`。
3. **要输出给人看的字符串/展示对象？** → `format.js`。但它只做格式转换，
   **不持有史实口径**：兵力约数换算是史实域逻辑，留在 `mock/strength.js#strengthText`；
   人物配色口径留在 `mock/figures.js#figureColor`。

其余去处：

- **设计 token / 配色常量** → `styles/global.css`（`:root`）与 `core/constants/colors.js`，
  不进 `utils/`（utils 只做运算，不定义取值）。
- **颜色换算**（hex→rgba、透明度、亮暗判定）当前**无模块**：全仓 JS 侧不存在色值运算，
  CSS 里的 `rgba(...)`/渐变均为字面量。真出现调用方时再按上面的规则建 `color.js`，
  与 `core/constants/colors.js`（**取值**单源）分工：前者算，后者存。
- **只被一个组件用到的派生量** → 留在该组件，不要为了"看起来整洁"上收。
- **有状态的（缓存、订阅、定时器）** → `composables/`，不是 utils。

## 硬约束

- **`parseDate` 的记忆化不可删**：日期串是有限集合，播放时每秒调用数千次，
  去掉即退化为每秒数千次 `new Date` 解析。任何时间工具都必须经它取时间戳，
  禁止在别处重建 `new Date('...T00:00:00+08:00')`。
- **时间窗语义单源**：`to` 含当日（`endOfDay` 补到当日 23:59:59.999），
  一律走 `inWindow` / `endOfDay`，禁止在组件里自建副本
  （开区间会在跨天零点出现一天的判定空档，且与地图态势显隐、图例计数口径分叉）。
- **热路径零新增分配**：播放时每 50ms 一次的路径上，时间窗应先把 `from`/`to`
  预解析成时间戳，再走 `inWindow` 的数值分支；不要每帧新建数组/对象。
- **不造无人调用的工具**：新增导出必须当批就有调用方（仓库规范：死代码随手清）。
