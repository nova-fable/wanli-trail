<!--
  @file 时间轴组件：全宽档案时间带
  职责：播放/暂停/倍速/连播；月份-年份刻度尺 + 双色事件点 + 播放头日期气泡 +
  悬停预览（事件卡/轨道日期）；拖动轨道回溯（pointer 事件 + pointercancel 兜底）。
  数据来源：playback（时间/倍速）、EVENTS（事件刻度位置）。
  写路径：seekRatio/play/setSpeed/openEvent（usePlayback）。
-->
<script setup>
import { computed, ref, onBeforeUnmount } from 'vue'
import {
  playback,
  play,
  toggle,
  seek,
  seekRatio,
  setSpeed,
  openEvent,
  T_START,
  T_END,
} from '../composables/usePlayback'
import { EVENTS, EVENT_TYPES } from '../mock'
import { parseDate, formatCnDate } from '../utils/geo'
import { useI18n } from '../core/i18n'

const { t } = useI18n()

const speeds = [0.5, 1, 2, 4]

const SPAN = T_END - T_START
const pctOf = (ms) => ((ms - T_START) / SPAN) * 100

const fillPct = computed(() => pctOf(playback.time))
// 头部日期气泡在两端内收，避免出血裁切
const chipPct = computed(() => Math.min(95.5, Math.max(4.5, fillPct.value)))
const dateText = computed(() => formatCnDate(playback.time))

// 事件刻度：相邻过近时上下交错两排，避免粘连
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

// 月份刻度尺：每月小刻度，一月（年份）大刻度
const monthTicks = (() => {
  const ticks = []
  for (let y = 1934; y <= 1936; y++) {
    for (let m = 1; m <= 12; m++) {
      const ms = parseDate(`${y}-${String(m).padStart(2, '0')}-01`)
      if (ms < T_START || ms > T_END) continue
      ticks.push({ left: pctOf(ms), major: m === 1, label: m === 1 ? String(y) : null })
    }
  }
  return ticks
})()

const trackEl = ref(null)
let dragging = false
let wasPlaying = false

// 悬停预览：事件刻度卡 + 轨道日期气泡（替代延迟高、无样式的原生 title）
const hoverDot = ref(null) // { ev, idx, left }
const hoverRatio = ref(-1)

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
const hoverDate = computed(() =>
  hoverRatio.value >= 0 ? formatCnDate(T_START + hoverRatio.value * (T_END - T_START)) : '',
)

// 连播：回到 1934-10 从头自动播放到大会师（关闭逐事件暂停讲解）
function playThrough() {
  playback.autoTour = false
  seek(T_START)
  play()
}

function ratioOf(e) {
  const r = trackEl.value.getBoundingClientRect()
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
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
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
})
</script>

<template>
  <div class="timeline-dock">
    <div class="tl-top">
      <button
        class="tl-play"
        :title="playback.playing ? t('tip.pause') : playback.finished ? t('tip.replayFinished') : t('tip.play')"
        @click="toggle"
      >
        <span v-if="playback.playing">❚❚</span>
        <span v-else>▶</span>
      </button>

      <div class="tl-speed">
        <button
          v-for="s in speeds"
          :key="s"
          :class="{ on: playback.speed === s }"
          @click="setSpeed(s)"
        >
          {{ s }}×
        </button>
      </div>

      <button class="tl-continuous" :title="t('tip.continuous')" @click="playThrough">
        ⏭ 连播
      </button>

      <div class="tl-hint">{{ t('tl.hint') }}</div>

      <div class="tl-date">
        <div class="date-main">{{ dateText }}</div>
      </div>
    </div>

    <div class="tl-track-wrap">
      <div
        ref="trackEl"
        class="tl-track"
        role="slider"
        tabindex="0"
        aria-label="播放进度（左右方向键前后七天）"
        aria-valuemin="0"
        :aria-valuenow="Math.round(fillPct)"
        aria-valuemax="100"
        @pointerdown="onDown"
        @pointermove="onTrackMove"
        @pointerleave="onTrackLeave"
      >
        <div class="tl-rail"></div>
        <div class="tl-fill" :style="{ width: fillPct + '%' }"></div>

        <!-- 月份/年份刻度尺 -->
        <i
          v-for="(t, i) in monthTicks"
          :key="'t' + i"
          class="tl-tick"
          :class="{ major: t.major }"
          :style="{ left: t.left + '%' }"
        ></i>
        <span class="tl-year tl-year-start">1934.10</span>
        <span
          v-for="t in monthTicks.filter((t) => t.label)"
          :key="t.label"
          class="tl-year"
          :style="{ left: t.left + '%' }"
        >
          {{ t.label }}
        </span>

        <!-- 事件刻度 -->
        <div
          v-for="(d, i) in eventDots"
          :key="d.ev.id"
          class="tl-ev"
          :class="[d.past ? 'past' : 'future', d.lane === 1 ? 'lane-down' : '']"
          :style="{
            left: d.left + '%',
            ...(d.past
              ? { background: EVENT_TYPES[d.ev.type].color, '--ec': EVENT_TYPES[d.ev.type].color }
              : {}),
          }"
          @pointerdown.stop
          @click.stop="openEvent(d.ev)"
          @mouseenter="onDotEnter(d, i)"
          @mouseleave="onDotLeave"
        ></div>

        <!-- 播放头 + 日期气泡 -->
        <div class="tl-head" :style="{ left: fillPct + '%' }"></div>
        <div class="tl-head-chip" :style="{ left: chipPct + '%' }">{{ dateText }}</div>

        <!-- 悬停预览：轨道日期气泡 + 事件卡 -->
        <div
          v-if="hoverRatio >= 0 && !dragging"
          class="tl-hover-chip"
          :style="{ left: Math.min(95.5, Math.max(4.5, hoverRatio * 100)) + '%' }"
        >
          {{ hoverDate }}
        </div>
        <div
          v-if="hoverDot"
          class="tl-ev-card"
          :style="{ left: Math.min(88, Math.max(12, hoverDot.left)) + '%' }"
        >
          <div class="c-name">
            <i :style="{ background: EVENT_TYPES[hoverDot.ev.type].color }"></i>
            {{ hoverDot.idx + 1 }}. {{ hoverDot.ev.name }}
          </div>
          <div class="c-date">{{ hoverDot.ev.dateLabel }} · {{ EVENT_TYPES[hoverDot.ev.type].label }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
