/**
 * @file 时间窗与天数工具：把「日期串比较」的所有写法收敛到两个语义上
 *
 * 职责：时间窗判定（`inWindow`）与「长征第 N 天」（`dayOfMarch`）。
 * 依赖：`./geo.js` 的 `parseDate` / `endOfDay`——**不要在此重建解析或补日副本**，
 *       `parseDate` 带记忆化且是热路径（播放时每秒数千次）的共同入口。
 *
 * 边界：
 * - 时间窗一律**闭合区间**且 `to` 含当日（`endOfDay` 补到当日 23:59:59.999），
 *   与地图态势显隐、图例计数、字幕条同源；写成开区间会在跨天零点出现一天的判定空档。
 * - 超过 24 小时的线性插值（如 `dayOfMarch`）一律以 UTC 毫秒为准，
 *   本项目时间戳全部锚定东八区零点（见 `parseDate`），故不受运行环境时区影响，
 *   也不受夏令时影响（东八区无夏令时）。
 */

import { DAY_MS, endOfDay, parseDate } from './geo'

/**
 * 时刻是否落在 [from, to] 时间窗内（`to` 含当日）
 *
 * 调用频率高的调用方（每 50ms 的渲染路径）应先自行把 `from`/`to` 预解析成时间戳，
 * 再直接比较，避免重复进入 `parseDate` 的记忆化查表。
 *
 * @param {string|number} from 起始日期串 `'YYYY-MM-DD'`，或已解析的时间戳
 * @param {string|number} to 结束日期串（含当日），或已解析的时间戳
 * @param {number} t 待判定时刻（毫秒时间戳）
 * @returns {boolean}
 */
export function inWindow(from, to, t) {
  const a = typeof from === 'number' ? from : parseDate(from)
  const b = typeof to === 'number' ? to : endOfDay(to)
  return a <= t && t <= b
}

/**
 * 长征第 N 天：出发日（`departureDateStr`）当天记第 1 天
 *
 * @param {string} dateStr 事件日期串 `'YYYY-MM-DD'`
 * @param {string} departureDateStr 出发日期串，全应用同一口径（`DEPARTURE_DATE`）
 * @returns {number} N ≥ 1；早于出发日返回 ≤ 0，由调用方决定是否降级为「出发前」
 */
export function dayOfMarch(dateStr, departureDateStr) {
  return Math.floor((parseDate(dateStr) - parseDate(departureDateStr)) / DAY_MS) + 1
}
