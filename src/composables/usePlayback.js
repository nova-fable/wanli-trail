/**
 * @file 播放引擎（应用核心单例）
 *
 * 职责：时间域 1934-10-01 → 1936-10-31 的推进、倍速、事件跨越检测与讲解暂停。
 * 数据来源：EVENTS（按日期升序）。
 * 写路径：playback 响应式单例（时间/播放态/面板事件/markerMode 等），
 * SandboxMap/TimelineBar/EventPanel 等全部消费方只读或经导出函数写。
 *
 * 驱动：setInterval（遮挡环境可用）+ tick dt 限幅/跳帧（后台强化节流防护）。
 */
import { reactive, markRaw } from 'vue'
import { EVENTS } from '../mock'
import { parseDate, clamp, DAY_MS } from '../utils/geo'
import { PLAYBACK } from '../core/constants/playback'
import { FALLBACKS } from '../core/constants/ui'
import { MARKER_MODE } from '../core/enums'

export const T_START = parseDate('1934-10-01')
export const T_END = parseDate('1936-10-31')

const sortedEvents = EVENTS // events.js 已按日期升序导出
const evDate = (e) => parseDate(e.date)

export const playback = reactive({
  time: T_START,
  playing: false,
  speed: 1,
  started: false, // 是否已通过开场页
  autoTour: true, // 演示模式：跨越事件时自动暂停讲解
  follow: true, // 镜头跟随
  finished: false,
  currentEvent: null, // 自动暂停所在的事件
  panelEvent: null, // 面板当前展示的事件（自动暂停或点击）
  lastEventArmy: 'first', // 最近跨过事件所属部队，镜头跟随依据
  markerMode: MARKER_MODE.MARCH, // 标记显隐：随行军浮现（未抵达隐藏）| 全部常显，枚举见 core/enums
  basemap: 'amap',
  toast: '', // 轻提示（精神印记等）
})

let intervalId = null
let lastTs = null
let nextEventIdx = 0

function syncEventPointer() {
  const t = playback.time
  nextEventIdx = sortedEvents.findIndex((e) => evDate(e) > t)
  if (nextEventIdx < 0) nextEventIdx = sortedEvents.length
  // 最近一个已发生过的事件（用于镜头跟随）
  let army = 'first'
  for (let i = 0; i < sortedEvents.length; i++) {
    if (evDate(sortedEvents[i]) <= t) army = sortedEvents[i].army === 'all' ? army : sortedEvents[i].army
  }
  playback.lastEventArmy = army
}

// 定时器驱动（而非 rAF）：窗口被遮挡/失焦时 rAF 会被系统暂停，定时器仍能推进。
// 但后台标签会被强化节流（约 1 次/分钟），dt 会暴涨——大于 5s 视为"曾被挂起"：
// 跳过该帧不推进（恢复后从原时间继续），其余帧限幅 2s，防止遮挡期间"时间飞跃"误触终点
function tick() {
  if (!playback.playing) {
    lastTs = null
    return
  }
  const now = performance.now()
  if (lastTs == null) lastTs = now
  const rawDt = now - lastTs
  lastTs = now
  if (rawDt > PLAYBACK.SKIP_DT_MS) return
  const dt = Math.min(rawDt, PLAYBACK.MAX_DT_MS)
  const next = playback.time + (dt / 1000) * PLAYBACK.DAYS_PER_SEC * playback.speed * DAY_MS

  if (playback.autoTour) {
    const ev = sortedEvents[nextEventIdx]
    if (ev && evDate(ev) <= next) {
      // 停在该事件处，弹出讲解
      playback.time = evDate(ev)
      playback.playing = false
      playback.currentEvent = markRaw(ev)
      playback.panelEvent = markRaw(ev)
      playback.lastEventArmy = ev.army === 'all' ? playback.lastEventArmy : ev.army
      lastTs = null
      return
    }
  } else {
    while (nextEventIdx < sortedEvents.length && evDate(sortedEvents[nextEventIdx]) <= next) {
      const ev = sortedEvents[nextEventIdx]
      if (ev.army !== 'all') playback.lastEventArmy = ev.army
      nextEventIdx++
    }
  }

  if (next >= T_END) {
    playback.time = T_END
    playback.playing = false
    playback.finished = true
    lastTs = null
    return
  }
  playback.time = next
}

export function play() {
  if (playback.finished) {
    seek(T_START)
  }
  playback.currentEvent = null
  playback.panelEvent = null
  // 跳过刚好停在当前时间点的事件（已讲解过），从下一个事件继续检测
  syncEventPointer()
  playback.playing = true
  if (intervalId == null) {
    lastTs = null
    intervalId = setInterval(tick, PLAYBACK.TICK_MS)
  }
}

export function pause() {
  playback.playing = false
  // 暂停即停表：避免 interval 常驻空转（play() 会按需重建）
  if (intervalId != null) {
    clearInterval(intervalId)
    intervalId = null
  }
  lastTs = null
}

export function toggle() {
  playback.playing ? pause() : play()
}

export function seek(t, opts = {}) {
  playback.time = clamp(t, T_START, T_END)
  // finished 仅由 tick 自然到达终点置位：拖动/跳转不应误触结语或重播回卷
  playback.currentEvent = null
  if (!opts.keepPanel) playback.panelEvent = null
  syncEventPointer()
}

export function seekRatio(r, opts = {}) {
  seek(T_START + r * (T_END - T_START), opts)
}

export function setSpeed(s) {
  playback.speed = s
}

export function openEvent(ev) {
  playback.panelEvent = markRaw(ev)
}

export function closePanel() {
  playback.panelEvent = null
  playback.currentEvent = null
}

// 开场页 → 开始演示
export function startTour() {
  playback.started = true
  playback.autoTour = true
  playback.follow = true
  seek(T_START)
  play()
}

// 开场页 → 自由探索（跳到终点看全貌）
export function startExplore() {
  playback.started = true
  playback.autoTour = false
  playback.follow = false
  playback.playing = false
  seek(T_END)
}

// 重新播放
export function restart() {
  startTour()
}

export function eventOrder(ev) {
  const i = sortedEvents.indexOf(ev)
  return i < 0 ? null : i + 1
}

let toastTimer = null
export function flashToast(text) {
  playback.toast = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    playback.toast = ''
  }, FALLBACKS.TOAST_MS)
}
