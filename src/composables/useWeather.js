/**
 * @file 天气与季节取数层（mock 单源的运行时查找，供地图样式与氛围特效订阅）
 *
 * 命中规则见 docs/dev/data-format.md：季节带取当前时间所在窗；天气节点全局唯一，
 * 同时命中多个时取 from 最晚。只读查找，不写任何状态。
 */
import { computed } from 'vue'
import { SEASONS, WEATHER_NODES } from '../mock'
import { playback } from './usePlayback'
import { parseDate, endOfDay } from '../utils/geo'
import { inWindow } from '../utils/date'

// 时间窗预解析成时间戳，查找只走 inWindow 的数值分支（endOfDay 语义：to 含当日）
const SEASON_SPANS = SEASONS.map((s) => ({ ...s, fromT: parseDate(s.from), toT: endOfDay(s.to) }))
const NODE_SPANS = WEATHER_NODES.map((n) => ({ ...n, fromT: parseDate(n.from), toT: endOfDay(n.to) }))

export function useWeather() {
  const season = computed(
    () => SEASON_SPANS.find((s) => inWindow(s.fromT, s.toT, playback.time)) || SEASON_SPANS[0],
  )
  const tone = computed(() => season.value.tone)
  const weatherNode = computed(() =>
    NODE_SPANS.filter((n) => inWindow(n.fromT, n.toT, playback.time))
      .reduce((best, n) => (!best || n.fromT > best.fromT ? n : best), null),
  )
  return { season, tone, weatherNode }
}
