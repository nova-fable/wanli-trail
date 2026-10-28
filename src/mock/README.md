/**
 * @file 数据仓库使用契约（改数据前必读）
 *
 * 本目录是**史实数据的唯一单源**；`docs/history/` 与 `docs/spirit/` 是它的成文档化视图，
 * 二者必须同一次改动内保持一致。字段级规范见 docs/dev/data-format.md。
 *
 * ## 目录归类
 *
 * ```text
 * mock/
 *   index.js            历史数据仓库 barrel —— 全应用唯一引用入口
 *   events/index.js     事件装配层：EVENT_TYPES / 排序 / 派生视图
 *   events/catalog.js   可变绑定与 setter（破循环用，零依赖）
 *   events/             57 个事件按部队分四个领域文件（n25 / red-first / red-fourth / red-second）
 *   situation/          战场态势四组实体（zones / blockades / units / japan）
 *   armies.js           四路红军元信息（含 color/provinces 等展示字段）
 *   routes/             四路红军带日期航点
 *   figures.js          人物志（firstEvent 引用事件 id）
 *   strength.js         兵力锚点与 STRENGTH_TOTAL 口径
 *   phases.js quotes.js 时间轴叙述层（阶段字幕 / 诗词金句）
 *   rivers.js stories.js 江河要津走线 / 精神印记
 * ```
 *
 * ## 引用规则
 *
 * - 一律 `import { EVENTS } from '../mock'`（barrel），禁止 import 领域文件
 *   （`../mock/events/red-first`）——领域文件是数据分片，不是 API。
 * - 子 barrel（`events/index.js`、`situation/index.js`）只供本目录内部装配使用，
 *   外部一律走主 barrel；`situation/index.js` 目前仅由 `index.js` 转出。
 * - 领域文件禁止 import 上层 barrel（会形成循环）；需要跨域引用时改由 barrel 装配，
 *   先例见 `events/catalog.js` 的 setter 注入与 `mock/index.js` 的装配顺序契约。
 * - 数据文件不得 import `components/` `map/` `composables/`（依赖方向单向向下）。
 *
 * ## 事件领域文件契约
 *
 * - 新事件只管插入对应部队文件；**插入位置不影响运行时顺序**——排序在
 *   `events/index.js` 装配时按 `date` 升序统一完成。
 * - `id` 命名 `<部队前缀>-<slug>`（`f1-` `f2-` `f4-` `n25-` `grand-`），一经发布不改
 *   （`figures.js#firstEvent` 引用它）。
 * - 每条事件字段：`id/army/type/name/place/date/dateLabel/lat/lng/zoom/[major]/people/desc`。
 *
 * ## 态势实体契约
 *
 * - 四组实体字段：`id/name/from/to/dateLabel/desc`，另加几何字段
 *   （`lat+lng+radius` 苏区 / `latlngs` 封锁线 / `lat+lng+short` 国民党军 / `lat+lng` 日军）。
 * - 时间窗语义统一 `parseDate(from) ≤ t ≤ endOfDay(to)`（to 含当日），与图例计数同源。
 * - 封锁线 `to` = 被突破日；苏区 `to` = 主力撤离日；敌情窗口必须覆盖对应红军事件时段。
 *
 * ## 互引用自检（提交前）
 *
 * 1. `figures.firstEvent` → `events.id` 全部存在
 * 2. 各 `routes` 的 `date` 单调不减
 * 3. `quotes/phases` 时间窗无重叠、无空洞（phases 需覆盖 T_START→T_END 全程）
 * 4. `STRENGTH` 锚点升序且与 `STRENGTH_TOTAL` 口径自洽（出发 ≈ 18.6 万 / 到达 ≈ 5.6 万）
 */
export {}
