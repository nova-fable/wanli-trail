<!--
  @file 时间轴组件：全宽档案时间带
  职责：播放/暂停/倍速/连播；月份-年份刻度尺 + 双色事件点 + 播放头日期气泡 +
  悬停预览（事件卡/轨道日期）；拖动轨道回溯（pointer 事件 + pointercancel 兜底）。
  数据来源：playback（时间/倍速）、EVENTS（事件刻度位置）。
  写路径：seekRatio/play/setSpeed/openEvent（usePlayback）。
  逻辑层：刻度几何 / 悬停 / 拖动状态机在 composables/useTimeline.js（本文件只留视图与按钮态）。
-->
<script setup>
import { onBeforeUnmount } from 'vue'
import { playback, toggle, seek, play, setSpeed, openEvent, T_START } from '../composables/usePlayback'
import { useTimeline } from '../composables/useTimeline'
import { EVENTS, EVENT_TYPES } from '../mock'
import { useI18n } from '../core/i18n'

const { t } = useI18n()

const speeds = [0.5, 1, 2, 4]

const {
  trackEl,
  dragging,
  fillPct,
  chipPct,
  dateText,
  hoverDot,
  hoverRatio,
  hoverDate,
  eventDots,
  monthTicks,
  yearTicks,
  onDotEnter,
  onDotLeave,
  onTrackMove,
  onTrackLeave,
  onDown,
  teardownDrag,
} = useTimeline()

// 连播：回到 1934-10 从头自动播放到大会师（关闭逐事件暂停讲解）
function playThrough() {
  playback.autoTour = false
  seek(T_START)
  play()
}

onBeforeUnmount(teardownDrag)
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
        {{ t('tl.continuous') }}
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
        :aria-label="t('tl.trackAria')"
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
          v-for="(tk, i) in monthTicks"
          :key="'t' + i"
          class="tl-tick"
          :class="{ major: tk.major }"
          :style="{ left: tk.left + '%' }"
        ></i>
        <span class="tl-year tl-year-start">1934.10</span>
        <span
          v-for="tk in yearTicks"
          :key="tk.label"
          class="tl-year"
          :style="{ left: tk.left + '%' }"
        >
          {{ tk.label }}
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
