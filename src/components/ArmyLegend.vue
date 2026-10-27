<!--
  @file 左上图例面板：部队显隐 / 兵力消长 / 战场态势开关 / 标记显隐设置
  职责：汇总四军状态与态势计数（与地图同用 endOfDay 时间窗语义）；
  所有开关直写 useLayers/usePlayback 状态，由 SandboxMap 的 watch 消费。
-->
<script setup>
import { computed } from 'vue'
import {
  ARMIES,
  ZONES,
  KMT_BLOCKADES,
  KMT_UNITS,
  JAPAN_CRISES,
  RIVERS,
  STORIES,
  strengthAt,
  strengthText,
  STRENGTH_TOTAL,
} from '../mock'
import {
  armyVisible,
  toggleArmy,
  armyState,
  situationVisible,
} from '../composables/useLayers'
import { playback } from '../composables/usePlayback'
import { legendCollapsed } from '../composables/usePrefs'
import { useI18n } from '../core/i18n'
import { MARKER_MODE } from '../core/enums'

const { t } = useI18n()
import { inWindow } from '../utils/date'

const collapsed = legendCollapsed

function statusText(a) {
  const s = armyState[a.key]
  if (!s.started) return t('legend.status.idle')
  if (s.done) return t('legend.status.done')
  return t('legend.status.marching', { pct: s.pct })
}

// 当前时间点上各态势层活跃实体数（与地图显隐同用 inWindow 语义，保证计数一致）
const counts = computed(() => {
  const t = playback.time
  const active = (x) => inWindow(x.from, x.to, t)
  return {
    zones: ZONES.filter(active).length,
    kmt: [...KMT_BLOCKADES, ...KMT_UNITS].filter(active).length,
    japan: JAPAN_CRISES.filter(active).length,
    stories: STORIES.filter(active).length,
    rivers: RIVERS.length, // 静态地理层，无时间窗
  }
})

// 态势条目元数据：文案走词典（随语言重算）；color 是视觉域常量
const SITUATION_ITEMS = [
  { key: 'zones', color: '#c62828' },
  { key: 'kmt', color: '#546e7a' },
  { key: 'japan', color: '#8e2020' },
  { key: 'stories', color: '#d4a94e' },
  { key: 'rivers', color: '#2f7fbf' },
].map((it) => ({
  ...it,
  name: t(`legend.item.${it.key}.name`),
  sub: t(`legend.item.${it.key}.sub`),
  tip: t(`legend.item.${it.key}.tip`),
}))

// 兵力消长
const strengths = computed(() => {
  const t = playback.time
  const rows = ARMIES.map((a) => {
    const n = strengthAt(a.key, t)
    return { army: a, n, pct: n == null ? 0 : Math.max(2, Math.round((n / 86000) * 100)) }
  })
  const total = rows.reduce((s, r) => s + (r.n || 0), 0)
  return { rows, totalText: total > 0 ? strengthText(total) : '—' }
})
</script>

<template>
  <div class="army-legend">
    <h4 class="lg-head" :title="t('legend.fold')" @click="collapsed = !collapsed">
      红军部队
      <span class="lg-fold">{{ collapsed ? '▸' : '▾' }}</span>
    </h4>
    <div v-show="!collapsed">
    <button
      v-for="a in ARMIES"
      :key="a.key"
      class="army-item"
      :class="{ off: !armyVisible[a.key] }"
      :title="armyVisible[a.key] ? t('legend.hideTip') : t('legend.showTip')"
      @click="toggleArmy(a.key)"
    >
      <span class="swatch" :style="{ background: a.color }"></span>
      <span class="a-info">
        <span class="a-name">{{ a.name }}</span>
        <span class="a-sub">{{ a.sub }} · {{ a.mileage }}</span>
      </span>
      <span class="a-status">{{ statusText(a) }}</span>
    </button>

    <h4 class="lg-sec">{{ t('legend.strength') }}</h4>
    <div class="str-box">
      <div class="str-total">
        <span class="str-num">{{ strengths.totalText }}</span>
        <span class="str-sub">{{ t('legend.strengthRange', { from: STRENGTH_TOTAL.start, to: STRENGTH_TOTAL.end }) }}</span>
      </div>
      <div v-for="r in strengths.rows" :key="r.army.key" class="str-row">
        <span class="str-name" :style="{ color: r.army.color }">{{ r.army.short }}</span>
        <div class="str-bar">
          <i :style="{ width: r.pct + '%', background: r.army.color }"></i>
        </div>
        <span class="str-n">{{ strengthText(r.n) }}</span>
      </div>
    </div>

    <h4 class="lg-sec">{{ t('legend.situation') }}</h4>
    <button
      v-for="s in SITUATION_ITEMS"
      :key="s.key"
      class="army-item"
      :class="{ off: !situationVisible[s.key] }"
      :title="s.tip"
      @click="situationVisible[s.key] = !situationVisible[s.key]"
    >
      <span class="swatch" :style="{ background: s.color }"></span>
      <span class="a-info">
        <span class="a-name">{{ s.name }}</span>
        <span class="a-sub">{{ s.sub }}</span>
      </span>
      <span class="a-status">{{ t('legend.count', { n: counts[s.key] }) }}</span>
    </button>

    <h4 class="lg-sec">{{ t('legend.display') }}</h4>
    <div class="mode-seg" :title="t('legend.displayTip')">
      <button :class="{ on: playback.markerMode === MARKER_MODE.MARCH }" @click="playback.markerMode = MARKER_MODE.MARCH">
        {{ t('legend.mode.march') }}
      </button>
      <button :class="{ on: playback.markerMode === MARKER_MODE.ALL }" @click="playback.markerMode = MARKER_MODE.ALL">
        {{ t('legend.mode.all') }}
      </button>
    </div>
    <div class="mode-note">
      {{ t(playback.markerMode === MARKER_MODE.MARCH ? 'legend.modeNote.march' : 'legend.modeNote.all') }}
    </div>
    </div>
  </div>
</template>
