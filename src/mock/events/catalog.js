/**
 * @file 长征关键事件数据集（史实唯一单源）
 *
 * 按部队分四个领域文件，导出时统一按日期升序排序（完整契约见 ./README.md）。
装配契约：EVENT_TYPES 与 EVENTS 由上层 ./index.js 装配层用 setter 注入，
本目录不反向依赖任何 barrel 模块（避免 barrel → figures → barrel 循环）。
 */
import n25Events from './n25'
import redFirstEvents from './red-first'
import redFourthEvents from './red-fourth'
import redSecondEvents from './red-second'

/** 事件类型元数据（由 events.js 桶注入；含 label/mark/color） */
export let EVENT_TYPES = {}

/** 按日期升序的事件全量（由 events.js 桶注入；装配前为 null） */
export let EVENTS = null

/** 装配入口（仅 events.js 调用一次） */
export function bindEvents(all) {
  EVENTS = all
}

/** 装配事件类型元数据（仅 events.js 调用一次） */
export function bindEventTypes(types) {
  EVENT_TYPES = types
}
