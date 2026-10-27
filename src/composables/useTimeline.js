/**
 * @file 时间带派生逻辑与拖动 seek 状态机（TimelineBar 的逻辑层）
 *
 * 职责：刻度几何（事件点 / 月份-年份刻度）、悬停预览、拖动 seek 状态机。
 * 数据来源：playback（时间）、EVENTS（事件刻度）、T_START/T_END（时间域）。
 * 写路径：seekRatio（拖动）/ openEvent（点击刻度）。
 *
 * 热路径约束（AGENTS.md）：播放时 render 每 50ms 一次，本文件**不在 render 路径上分配**——
 * - `eventDots` 是 computed：只依赖 EVENTS（常量）与 playback.time，播放中每 50ms 重算一次是
 *   本来就必须的（past 着色随时间变），但重算只新建长度 = EVENTS.length 的小对象数组，
 *   与拆分前逐字相同；不新增任何每帧分配。
 * - `monthTicks` 是模块级常量：与 playback.time 无关，原实现是组件内的 IIFE 常量，
 *   抽到 composable 后**仍然只在模块求值时算一次**（若写成 computed，虽然也只算一次，
 *   但会引入无谓的依赖追踪开销；写成函数让调用方每次调则退化为每帧重算，均不可取）。
 * - 时间戳一律经 `parseDate`（utils/geo.js 记忆化）取，禁止 `new Date(...)`。
 *
 * `pctOf` 依赖 T_START/SPAN：三者都是模块常量，刻度几何在模块作用域算一次即可，
 * 不放进任何每次 render 都执行的位置。
 */
import { computed, ref } from 'vue'
import { playback, seekRatio, openEvent, T_START, T_END } from './usePlayback'
import { EVENTS } from '../mock'
import { parseDate, formatCnDate } from '../utils/geo'

/** 时间域跨度（毫秒），与 usePlayback 的时间域单源 */
const SPAN = T_END - T_START

/** 时间戳 → 轨道百分比（模块内几何单源，事件点与月份刻度共用） */
const pctOf = (ms) => ((ms - T_START) / SPAN) * 100

/** 事件刻度：相邻过近时上下交错两排，避免粘连 */
const eventDots = computed(() => {
  const dots = EVENTS.map((ev, i) => ({
    ev,
    idx: i,
    left: pctOf(parseDate(ev.date)),
    past: parseDate(ev.date) <= playback.time,
    lane: 0,
  }))
  let prev = null
  for (const d of dots) {
    if (prev !== null && d.left - prev.left < 1.25 && prev.lane === 0) d.lane = 1
    prev = d
  }
  return dots
})

/**
 * 月份刻度尺：每月小刻度、一月（年份）大刻度。
 * 模块级常量：年份区间与时间域同源（T_START 所在年到 T_END 所在年），只算一次。
 */
const monthTicks = (() => {
  const ticks = []
  const y0 = new Date(T_START).getFullYear()
  const y1 = new Date(T_END).getFullYear()
  for (let y = y0; y <= y1; y++) {
    for (let m = 1; m <= 12; m++) {
      const ms = parseDate(`${y}-${String(m).padStart(2, '0')}-01`)
      if (ms < T_START || ms > T_END) continue
      ticks.push({ left: pctOf(ms), major: m === 1, label: m === 1 ? String(y) : null })
    }
  }
  return ticks
})()

/** 年份标签刻度（模板里 monthTicks.filter(...) 的等价派生，避免每次 render 过滤） */
const yearTicks = monthTicks.filter((t) => t.label)

/**
 * 时间带逻辑：返回模板所需的响应式量与事件处理器
 * @returns {object} 刻度/悬停/拖动相关的 ref、computed 与 handler
 */
export function useTimeline() {
  const fillPct = computed(() => pctOf(playback.time))
  // 头部日期气泡在两端内收，避免出血裁切
  const chipPct = computed(() => Math.min(95.5, Math.max(4.5, fillPct.value)))
  const dateText = computed(() => formatCnDate(playback.time))

  const trackEl = ref(null)
  let dragging = false
  let wasPlaying = false

  // 悬停预览：事件刻度卡 + 轨道日期气泡（替代延迟高、无样式的原生 title）
  const hoverDot = ref(null) // { ev, idx, left }
  const hoverRatio = ref(-1)

  const hoverDate = computed(() =>
    hoverRatio.value >= 0 ? formatCnDate(T_START + hoverRatio.value * (T_END - T_START)) : '',
  )

  function onDotEnter(d, i) {
    hoverDot.value = { ev: d.ev, idx: i, left: d.left }
  }
  function onDotLeave() {
    hoverDot.value = null
  }

  function ratioOf(e) {
    const r = trackEl.value.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }

  function onTrackMove(e) {
    if (dragging) return
    const r = trackEl.value.getBoundingClientRect()
    hoverRatio.value = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }
  function onTrackLeave() {
    hoverRatio.value = -1
  }

  function onUp() {
    dragging = false
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    // 拖到终点不自动恢复播放：交由用户显式播放/重新演示
    if (wasPlaying && playback.time < T_END) playback.playing = true
    else if (wasPlaying) playback.playing = false
  }
  function onMove(e) {
    if (dragging) seekRatio(ratioOf(e), { keepPanel: true })
  }
  function onDown(e) {
    dragging = true
    wasPlaying = playback.playing
    playback.playing = false
    seekRatio(ratioOf(e), { keepPanel: true })
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  /** 连播：回到 1934-10 从头自动播放到大会师（关闭逐事件暂停讲解） */
  function playThrough() {
    playback.autoTour = false
    playback.playing = false
    playback.time = T_START
    playback.playing = true
  }

  /** 组件卸载时解绑（拖动中途切路由不会泄漏监听） */
  function cleanup() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }

  return {
    trackEl,
    dragging,
    fillPct,
    chipPct,
    dateText,
    hoverDot,
    hoverRatio,
    hoverDate,
  }
}
