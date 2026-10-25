<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import SandboxMap from './components/SandboxMap.vue'
import TimelineBar from './components/TimelineBar.vue'
import EventPanel from './components/EventPanel.vue'
import EventIndex from './components/EventIndex.vue'
import ArmyLegend from './components/ArmyLegend.vue'
import SubtitleBar from './components/SubtitleBar.vue'
import IntroOverlay from './components/IntroOverlay.vue'
import FiguresPanel from './components/FiguresPanel.vue'
import AtmosphereFx from './components/AtmosphereFx.vue'
import FinaleOverlay from './components/FinaleOverlay.vue'
import { playback, toggle, restart, startTour, seek, closePanel } from './composables/usePlayback'
import { BASEMAPS } from './composables/useMapBase'
import { initPrefs } from './composables/usePrefs'

// 恢复用户偏好（底图/倍速/开关/图层/图例折叠），需在子组件挂载前完成
initPrefs()

const showFigures = ref(false)
const showIndex = ref(false)
const showHelp = ref(false)
const showFinale = ref(false)

// 演示模式播放到终点 → 弹出长征精神结语
watch(
  () => playback.finished,
  (v) => {
    if (v && playback.autoTour && playback.started) showFinale.value = true
  },
)

const DAY_MS = 86400000

function closeTopOverlay() {
  if (showHelp.value) showHelp.value = false
  else if (showIndex.value) showIndex.value = false
  else if (showFigures.value) showFigures.value = false
  else if (showFinale.value) showFinale.value = false
  else if (playback.panelEvent) closePanel()
  else return false
  return true
}

function onKey(e) {
  // 焦点在按钮等可交互元素上时，空格/回车交给原生点击，避免双重触发
  const t = e.target
  if (
    t instanceof HTMLElement &&
    (t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') &&
    (e.code === 'Space' || e.code === 'Enter')
  ) {
    return
  }
  if (e.code === 'Escape') {
    e.preventDefault()
    closeTopOverlay()
    return
  }
  if (!playback.started) {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault()
      startTour()
    }
    return
  }
  if (e.code === 'Space') {
    e.preventDefault()
    toggle()
  } else if (e.code === 'ArrowRight') {
    e.preventDefault()
    seek(playback.time + 7 * DAY_MS, { keepPanel: true })
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault()
    seek(playback.time - 7 * DAY_MS, { keepPanel: true })
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <header class="app-header">
    <div class="app-title">
      <span class="title-star">★</span>
      红军长征沙盘
      <span class="years">1934 — 1936</span>
    </div>
    <div class="header-spacer"></div>

    <div class="seg" title="切换底图">
      <button
        v-for="b in BASEMAPS"
        :key="b.key"
        :class="{ on: playback.basemap === b.key }"
        @click="playback.basemap = b.key"
      >
        {{ b.name }}
      </button>
    </div>

    <button
      class="pill-toggle"
      :class="{ on: playback.follow }"
      title="播放时镜头跟随部队推进（拖动地图会自动关闭）"
      @click="playback.follow = !playback.follow"
    >
      <span class="led"></span>镜头跟随
    </button>

    <button
      class="pill-toggle"
      :class="{ on: playback.autoTour }"
      title="播放跨越关键事件时自动暂停并讲解"
      @click="playback.autoTour = !playback.autoTour"
    >
      <span class="led"></span>自动讲解
    </button>

    <button
      class="pill-toggle"
      :class="{ on: showFigures }"
      title="查看长征关键人物志，点击人物跳转其登场事件"
      @click="showFigures = !showFigures"
    >
      <span class="led"></span>人物志
    </button>

    <button
      class="pill-toggle"
      :class="{ on: showIndex }"
      title="44 个关键事件总览，点击条目跳转讲解"
      @click="showIndex = !showIndex"
    >
      <span class="led"></span>事件总览
    </button>

    <button
      class="pill-toggle finale-btn"
      title="查看长征精神结语：五大精神 · 数说长征 · 七律长征"
      @click="showFinale = true"
    >
      ★ 长征精神
    </button>

    <button class="pill-toggle" title="回到 1934 年 10 月重新播放" @click="restart">↻ 重新播放</button>
  </header>

  <main class="app-main">
    <div class="map-wrap">
      <SandboxMap />
      <div class="parchment-fx"></div>
      <div class="map-compass" title="上北下南">
        <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
          <circle cx="32" cy="32" r="27" fill="rgba(240,232,216,0.88)" stroke="#8a6f4d" stroke-width="1.5"/>
          <circle cx="32" cy="32" r="21.5" fill="none" stroke="#c9b283" stroke-width="1" stroke-dasharray="2 4"/>
          <path d="M32 7.5 L37.5 32 L32 28 L26.5 32 Z" fill="#c03a2b"/>
          <path d="M32 56.5 L37.5 32 L32 36 L26.5 32 Z" fill="#7a6f5c"/>
          <text x="32" y="21" text-anchor="middle" font-size="9.5" fill="#5a4a33" font-weight="700">北</text>
          <circle cx="32" cy="32" r="1.6" fill="#5a4a33"/>
        </svg>
      </div>
    </div>
    <AtmosphereFx />
    <ArmyLegend />
    <EventPanel />
    <FiguresPanel v-if="showFigures" @close="showFigures = false" />
    <EventIndex v-if="showIndex" @close="showIndex = false" />

    <button class="help-btn" title="操作说明（Esc 关闭）" @click="showHelp = !showHelp">?</button>
    <div v-if="showHelp" class="help-card">
      <h5>❖ 操作指南</h5>
      <div class="hk-row"><span>播放 / 暂停</span><kbd>空格</kbd></div>
      <div class="hk-row"><span>前后七天</span><span><kbd>←</kbd> <kbd>→</kbd></span></div>
      <div class="hk-row"><span>关闭浮层</span><kbd>Esc</kbd></div>
      <div class="hk-sec">
        拖动地图即接管镜头（自动关闭跟随）；点击地图事件点、时间轴刻度或事件总览条目可跳转讲解；左上角图例可隐藏部队与战场态势层；倍速越高跟随视野越广。
      </div>
    </div>
  </main>

  <footer class="app-footer">
    <SubtitleBar />
    <TimelineBar />
  </footer>

  <div v-if="playback.toast" class="app-toast">{{ playback.toast }}</div>

  <IntroOverlay v-if="!playback.started" />
  <FinaleOverlay v-if="showFinale" @close="showFinale = false" />
</template>
