/**
 * @file 时间带（TimelineBar）的逻辑层：刻度几何 / 悬停预览 / 拖动 seek 状态机
 *
 * 职责：把 TimelineBar 里与视图无关的部分收拢到一处——事件点与月份刻度的几何、
 * 悬停预览状态、pointer 拖动状态机（含 pointercancel 兜底与卸载解绑）。
 * 数据来源：playback（时间/播放态）、EVENTS（事件刻度）、T_START/T_END（时间域）。
 * 写路径：seekRatio（拖动/点击）/ openEvent（点击事件刻度）。
 *
 * 热路径约束（AGENTS.md「播放热路径禁止每帧重建大数组/新建对象」）：
 * - 事件刻度的布局骨架在模块求值期算一次；`past` 由 `watchEffect` 就地更新，
 *   且只在已发生条数变化时才写（每帧 O(log n) 二分 + 一次整数比较，无对象分配）。
 * - `monthTicks` 保持**模块级常量**（IIFE，与原组件内写法同构）：与时间无关，
 *   全进程只算一次。刻意不写成函数（调用方每次调 = 每帧重算）也不写成 computed
 *   （多一层依赖追踪却永远不变）。年份区间由 T_START/T_END 折算，不硬编码 1934/1936。
 * - 所有时间戳经 `parseDate`（utils/geo.js 记忆化）取得，不新建 `new Date(...)`；
 *   仅 monthTicks 的年份边界用 `new Date(时间戳)` 取年号，属模块求值期的两次调用。
 */
import { computed, reactive, ref, watchEffect } from 'vue'
import { playback, play, pause, seekRatio, openEvent, T_START, T_END } from './usePlayback'
import { EVENTS } from '../mock'
import { parseDate, formatCnDate } from '../utils/geo'

/** 时间域跨度（毫秒）：与 usePlayback 的 T_START/T_END 单源，模块内只算一次 */
const SPAN = T_END - T_START

/** 时间戳 → 轨道百分比（事件点与月份刻度共用的几何，模块求值期定型） */
const pctOf = (ms) => ((ms - T_START) / SPAN) * 100

/**
 * 事件刻度静态骨架（模块求值期算一次）：ev / idx / left / lane / ts 全为常量。
 * - `left` 由 parseDate（记忆化）+ pctOf 得出，只依赖静态 EVENTS
 * - `lane` 是"相邻过近时上下交错两排"的布局结果，只依赖相邻 left 差，与时间无关
 * - `ts` 预解析的事件时间戳，供热路径做 past 判定（避免每帧重复 parseDate）
 * 每帧真正变化的只有 past 一个布尔量，见 eventDots。
 */
const DOT_SKELETON = (() => {
  const dots = EVENTS.map((ev, i) => {
    const ts = parseDate(ev.date)
    return { ev, idx: i, ts, left: pctOf(ts), lane: 0 }
  })
  let prev = null
  for (const d of dots) {
    if (prev !== null && d.left - prev.left < 1.25 && prev.lane === 0) d.lane = 1
    prev = d
  }
  return dots
})()

/**
 * 已越过事件数（二分；DOT_SKELETON 按时间升序，与 EVENTS 同序）。
 * 与 SandboxMap.countPassed 同构：EVENTS 已由 mock 装配层按 date 升序保证。
 */
function countPassed(t) {
  let lo = 0
  let hi = DOT_SKELETON.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (DOT_SKELETON[mid].ts <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * 事件刻度（模板消费 ev/idx/left/lane/past）。
 *
 * 只有 `past` 随播放变化，而 left/lane/ev/idx 是布局常量，故：
 * - 骨架在模块求值期算一次（parseDate 记忆化 + 交错扫描都不进热路径）
 * - past 用 `watchEffect` 就地写到响应式数组上，且**只在已发生条数变化时**才写
 *   （countPassed 是 O(log n) 二分），把每帧的 57 次对象分配降为一次整数比较
 *
 * 用 watchEffect 而非 computed 的原因：这里要写响应式状态（dotState[i].past），
 * 在 computed 的求值函数里改状态属反模式——依赖可能自触发，且缓存语义不清。
 */
const dotState = reactive(DOT_SKELETON.map((d) => ({ ...d, past: false })))
let lastPassed = -1

watchEffect(() => {
  const passed = countPassed(playback.time)
  if (passed === lastPassed) return
  for (let i = 0; i < dotState.length; i++) dotState[i].past = i < passed
  lastPassed = passed
})

/** 月份刻度尺：每月小刻度，一月（年份）大刻度；年份范围由时间域折算 */
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

/** 年份标签刻度：模块常量（模板不再每次 render 跑 `monthTicks.filter(...)`） */
const yearTicks = monthTicks.filter((tk) => tk.label)

/**
 * 时间带逻辑与事件处理器
 * @returns {object} 供 TimelineBar 模板使用的响应式量、常量与 handler
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
  function onTrackMove(e) {
    if (dragging) return
    const r = trackEl.value.getBoundingClientRect()
    hoverRatio.value = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }
  function onTrackLeave() {
    hoverRatio.value = -1
  }

  function ratioOf(e) {
    const r = trackEl.value.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }
  function onDown(e) {
    dragging = true
    wasPlaying = playback.playing
    pause()
    seekRatio(ratioOf(e), { keepPanel: true })
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }
  function onMove(e) {
    if (dragging) seekRatio(ratioOf(e), { keepPanel: true })
  }
  function onUp() {
    dragging = false
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    // 拖到终点不自动恢复播放：交由用户显式播放/重新演示
    if (wasPlaying && playback.time < T_END) play()
  }

  /** 卸载解绑：拖动中途切路由不留悬浮监听（onUp 在拖动结束后已自行解绑） */
  function teardownDrag() {
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
    eventDots: dotState,
    monthTicks,
    yearTicks,
    onDotEnter,
    onDotLeave,
    onTrackMove,
    onTrackLeave,
    onDown,
    teardownDrag,
  }
}
