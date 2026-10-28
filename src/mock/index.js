/**
 * @file 史实数据仓库（唯一单源，barrel）
 *
 * 这是全应用引用史实数据的**唯一入口**：`import { EVENTS } from '../mock'`（本项目未配置路径别名）。
 * 目录按域归类（领域文件只放数据、不写逻辑）：
 * - `./events/`    57 个关键事件（按部队四个领域文件，导出时按日期升序）
 * - `./situation/` 战场态势四组实体（苏区 / 封锁线 / 国民党军 / 日军威胁）
 * - 其余单域文件：四路红军路线与元信息、人物、兵力、诗词、阶段、江河、精神印记
 *
 * 导出顺序契约（循环依赖的唯一出口）：本文件按数据依赖拓扑排序——
 * 底层域（armies/routes/events）先于引用它们的域（figures/strength）装配。
 * 事件对象生成的派生量（DEPARTURE_DATE/EVENT_TYPES/EVENTS/eventMeta）也在此装配，
 * 领域文件不反向 import 任何 barrel 模块。改数据前必读 docs/dev/data-format.md。
 */

// ===== 事件域（先于 figures/strength 装配：二者引用事件 id 与人名） =====
// 注意：只转出 EVENTS 与其派生量。四个部队领域文件（events/n25 等）**刻意不转出**——
// 它们是数据分片而非 API，AGENTS.md 禁止组件直接引用（id 前缀是唯一跨分片标识）。
export { EVENTS, EVENT_TYPES, DEPARTURE_DATE, eventMeta, eventIndexOf } from './events'

// ===== 部队与路线 =====
// 路线数据经 ARMIES[].route 消费（useLayers 做预处理），故不单独转出 route 默认导出。
export { ARMIES } from './armies'

// ===== 人物 / 兵力（引用事件 id 与人名） =====
// STRENGTH 锚点表仅 strength.js 内部使用，对外只暴露取数与格式化。
export { FIGURES, figureColor } from './figures'
export { STRENGTH_TOTAL, strengthAt, strengthText } from './strength'

// ===== 战场态势 / 地理 / 精神印记 =====
export { ZONES, KMT_BLOCKADES, KMT_UNITS, JAPAN_CRISES } from './situation'
export { RIVERS } from './rivers'
export { STORIES } from './stories'

// ===== 时间轴叙述层 =====
export { default as PHASES } from './phases'
export { QUOTES } from './quotes'
