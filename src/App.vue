<script setup>
/**
 * @file 应用根组件：双路由页面的装配层
 *
 * 职责：按路由渲染开场页/沙盘页；装配顶栏、地图、浮层；全局快捷键与结语页门控。
 * 数据来源：route（路由单例）、playback（播放引擎单例）、usePrefs（偏好恢复）。
 * 写路径：不直接写盘；用户意图经 composables（usePlayback）落地。
 *
 * 防闪烁说明：开场页是独立路由页（不初始化地图），配合 index.html 的 #boot 预置屏，
 * 刷新首帧永远与开场页同款，不再短暂露出地图。
 */
import { ref, watch, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
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
import { playback, toggle, restart, startTour, startExplore, seek, closePanel } from './composables/usePlayback'
import { BASEMAPS } from './composables/useMapBase'
import { EVENTS } from './mock'
import { initPrefs } from './composables/usePrefs'
import { route, navigate, initRouter, ROUTES } from './router'
import { useI18n } from './core/i18n'
// DAY_MS 单源在 utils：本文件此前自带一份 86400000 字面量副本
import { DAY_MS } from './utils/geo'

const Terrain3D = defineAsyncComponent(() => import('./components/Terrain3D.vue'))

// 恢复用户偏好（底图/倍速/开关/图层/图例折叠/语言），需在子组件挂载前完成
initPrefs()
// 初始化路由（读当前 hash → 首帧即落在正确页面）
initRouter()

const { t, lang: langState, setLang, langs } = useI18n()

/** 浮层开关：人物志 / 事件总览 / 操作指南 / 长征精神结语 */
const showFigures = ref(false)
const showIndex = ref(false)
const showHelp = ref(false)
const showFinale = ref(false)
const showTerrain3D = ref(false)

// 播放自然到达终点（演示讲解或连播）→ 弹出长征精神结语。
// finished 仅由 tick 置位（seek 不置位），拖动/跳转不会误触。
watch(
  () => playback.finished,
  (v) => {
    if (v && playback.started) showFinale.value = true
  },
)

/**
 * 开场页入口回调：按所选模式初始化播放状态并进入沙盘路由
 * @param {'tour'|'explore'} mode 开始演示（纪录片式讲解）/ 自由探索
 */
function onStart(mode) {
  if (mode === 'tour') startTour()
  else startExplore()
  navigate(ROUTES.SANDBOX)
}

/**
 * Esc 逐层关闭浮层（后开先关）
 * @returns {boolean} 是否有关闭对象（无则吞掉按键不做任何事）
 */
function closeTopOverlay() {
  if (showTerrain3D.value) showTerrain3D.value = false
  else if (showHelp.value) showHelp.value = false
  else if (showIndex.value) showIndex.value = false
  else if (showFigures.value) showFigures.value = false
  else if (showFinale.value) showFinale.value = false
  else if (playback.panelEvent) closePanel()
  else return false
  return true
}

/**
 * 全局快捷键分发
 * - 开场页：Enter/Space 开始演示
 * - 沙盘页：Space 播放暂停；←/→ 前后七天；Esc 逐层关浮层
 * - 焦点在 BUTTON/INPUT 等原生可交互元素上时，Space/Enter 让位给原生点击（避免双触发）
 */
function onKey(e) {
  const t = e.target
  const onNativeControl =
    t instanceof HTMLElement &&
    (t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')
  if (onNativeControl && (e.code === 'Space' || e.code === 'Enter')) return

  if (e.code === 'Escape') {
    e.preventDefault()
    closeTopOverlay()
    return
  }
  if (showTerrain3D.value) return
  if (route.name === ROUTES.INTRO) {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault()
      onStart('tour')
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
  <!-- 路由页 1：开场页（独立整页，不渲染地图，杜绝首帧闪烁） -->
  <IntroOverlay v-if="route.name === ROUTES.INTRO" @start="onStart" />

  <!-- 路由页 2：沙盘 -->
  <template v-else>
    <header class="app-header">
      <div class="app-title">
        <span class="title-star">★</span>
        {{ t('app.title') }}
        <span class="years">1934 — 1936</span>
      </div>
      <div class="header-spacer"></div>

      <div class="seg" :title="t('lang.label')">
        <button
          v-for="l in langs"
          :key="l.key"
          :class="{ on: langState.lang === l.key }"
          @click="setLang(l.key)"
        >
          {{ l.label }}
        </button>
      </div>

      <div class="seg" :title="t('tip.basemap')">
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
        :title="t('tip.follow')"
        @click="playback.follow = !playback.follow"
      >
        <span class="led"></span>{{ t('pill.follow') }}
      </button>

      <button
        class="pill-toggle"
        :class="{ on: playback.autoTour }"
        :title="t('tip.autoTour')"
        @click="playback.autoTour = !playback.autoTour"
      >
        <span class="led"></span>{{ t('pill.autoTour') }}
      </button>

      <button
        class="pill-toggle"
        :class="{ on: showFigures }"
        :title="t('tip.figures')"
        @click="showFigures = !showFigures"
      >
        <span class="led"></span>{{ t('pill.figures') }}
      </button>

      <button
        class="pill-toggle"
        :class="{ on: showIndex }"
        :title="t('tip.index', { n: EVENTS.length })"
        @click="showIndex = !showIndex"
      >
        <span class="led"></span>{{ t('pill.index') }}
      </button>

      <button
        class="pill-toggle finale-btn"
        :title="t('tip.finale')"
        @click="showFinale = true"
      >
        ★ 长征精神
      </button>

      <button
        class="pill-toggle"
        :class="{ on: showTerrain3D }"
        :title="t('tip.terrain3d')"
        @click="showTerrain3D = !showTerrain3D"
      >
        {{ t('pill.terrain3d') }}
      </button>

      <button class="pill-toggle" :title="t('tip.restart')" @click="restart">{{ t('pill.restart') }}</button>
    </header>

    <main class="app-main">
      <div class="map-wrap">
        <SandboxMap />
        <div class="parchment-fx"></div>
        <div class="map-compass" :title="t('tip.compass')">
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

      <button class="help-btn" :title="t('help.title')" @click="showHelp = !showHelp">{{ t('help.btn') }}</button>
      <div v-if="showHelp" class="help-card">
        <h5>{{ t('help.title') }}</h5>
        <div class="hk-row"><span>{{ t('help.hk.play') }}</span><kbd>Space</kbd></div>
        <div class="hk-row"><span>{{ t('help.hk.days') }}</span><span><kbd>←</kbd> <kbd>→</kbd></span></div>
        <div class="hk-row"><span>{{ t('help.hk.close') }}</span><kbd>Esc</kbd></div>
        <div class="hk-sec">
          {{ t('help.sec') }}
        </div>
      </div>
      <Terrain3D v-if="showTerrain3D" @close="showTerrain3D = false" />
    </main>

    <footer class="app-footer">
      <SubtitleBar />
      <TimelineBar />
    </footer>

    <div v-if="playback.toast" class="app-toast">{{ playback.toast }}</div>

    <FinaleOverlay v-if="showFinale" @close="showFinale = false" />
  </template>
</template>
