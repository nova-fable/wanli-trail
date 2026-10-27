/**
 * @file 史实数据仓库（唯一单源，barrel）
 *
 * 这是全应用引用史实数据的**唯一入口**：`import { EVENTS } from '@/mock'`。
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
export { default as n25Events } from './events/n25'
export { default as redFirstEvents } from './events/red-first'
export { default as redFourthEvents } from './events/red-fourth'
export { default as redSecondEvents } from './events/red-second'
export { EVENTS, EVENT_TYPES, DEPARTURE_DATE, eventMeta, eventIndexOf } from './events'

// ===== 部队与路线 =====
export { ARMIES, ARMY_MAP } from './armies'
export { default as redFirstRoute } from './routes/red-first'
export { default as redSecondRoute } from './routes/red-second'
export { default as redFourthRoute } from './routes/red-fourth'
export { default as red25Route } from './routes/red-25th'

// ===== 人物 / 兵力（引用事件 id 与人名） =====
export { FIGURES, figureColor } from './figures'
export { STRENGTH, STRENGTH_TOTAL, strengthAt, strengthText } from './strength'

// ===== 战场态势 / 地理 / 精神印记 =====
export { ZONES, KMT_BLOCKADES, KMT_UNITS, JAPAN_CRISES } from './situation'
export { RIVERS } from './rivers'
export { STORIES } from './stories'

// ===== 时间轴叙述层 =====
export { default as PHASES } from './phases'
export { QUOTES } from './quotes'
