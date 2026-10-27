/**
 * @file 长征关键事件（装配层，导出全应用的稳定公共 API）
 *
 * 领域数据在 ./n25.js / ./red-first.js / ./red-fourth.js / ./red-second.js；本文件负责三件事：
 * 1. 类型元数据 EVENT_TYPES 与派生量 DEPARTURE_DATE
 * 2. 装配：合并四路事件 → 按日期升序排序 → 回填 ./catalog.js 的绑定
 * 3. 派生视图：eventMeta / eventIndexOf（纯展示派生，不含时间计算——
 *    「长征第 N 天」需要 parseDate，属 utils/date.js#dayOfMarch，避免 mock 反向依赖 utils）
 *
 * 为什么事件对象来自 ./catalog.js（而非直接 import 领域文件）：
 * figures.js / strength.js 需要引用事件 id 与人名，若直接 import 本文件会形成
 * `barrel → figures → barrel` 循环。./catalog.js 不依赖任何 barrel，barrel 则保证
 * 它先于 figures 装配，故对外统一从本文件取 EVENTS。
 *
 * 全量汇总视图 EVENTS 只在 barrel 与本文件各出现一次——
 * 组件一律 `import { EVENTS } from '../mock'`，不要下沉到领域文件。
 */
import { EVENTS as BOUND_EVENTS, bindEvents, bindEventTypes } from './catalog'
import n25Events from './n25'
import redFirstEvents from './red-first'
import redFourthEvents from './red-fourth'
import redSecondEvents from './red-second'

/**
 * 事件类型元数据：`label` 展示名 / `mark` 地图书法单字徽记（宋体，替代跨平台不稳的 emoji）/
 * `color` 类型色（地图符号与时间轴刻度同源，见 core/constants/icons.js 的 EV_SHAPES 轮廓表）
 */
export const EVENT_TYPES = {
  depart: { label: '出发', mark: '出', color: '#e05c3f' },
  battle: { label: '战役', mark: '战', color: '#d32f2f' },
  meeting: { label: '会议', mark: '议', color: '#c9922e' },
  join: { label: '会师', mark: '会', color: '#e8b62c' },
  pass: { label: '天险', mark: '险', color: '#8d6e63' },
  arrive: { label: '到达', mark: '抵', color: '#4a90d9' },
  base: { label: '根据地', mark: '据', color: '#2e7d32' },
}

/** 长征起始日（中央红军于都出发），用于「长征第 N 天」计数 */
export const DEPARTURE_DATE = '1934-10-17'

// 装配顺序即依赖契约：先绑定 EVENT_TYPES，再排序事件并绑定 EVENTS
bindEventTypes(EVENT_TYPES)

/** 按日期升序的事件全量（date 为 YYYY-MM-DD，字典序即时间序） */
bindEvents(
  [...n25Events, ...redFirstEvents, ...redFourthEvents, ...redSecondEvents].sort((a, b) =>
    a.date.localeCompare(b.date),
  ),
)

/** 事件全量（装配后引用稳定；桶文件 re-export 的即此引用） */
export const EVENTS = BOUND_EVENTS

/**
 * 单事件派生元数据：序号（1 基，与时间轴刻度/索引面板一致）与类型元数据
 * @param {object} ev EVENTS 成员
 * @returns {{ order: number, total: number, typeMeta: object }}
 */
export function eventMeta(ev) {
  return {
    order: EVENTS.indexOf(ev) + 1,
    total: EVENTS.length,
    typeMeta: EVENT_TYPES[ev.type] || EVENT_TYPES.battle,
  }
}

/**
 * 事件序号（1 基；非 EVENTS 成员返回 null）
 * @param {object} ev EVENTS 成员
 */
export function eventIndexOf(ev) {
  const i = EVENTS.indexOf(ev)
  return i < 0 ? null : i + 1
}
