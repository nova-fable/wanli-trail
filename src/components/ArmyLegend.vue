<script setup>
import { computed } from 'vue'
import { ARMIES } from '../data/armies'
import { ZONES, KMT_BLOCKADES, KMT_UNITS, JAPAN_CRISES } from '../data/situation'
import { RIVERS } from '../data/rivers'
import { STORIES } from '../data/stories'
import { strengthAt, strengthText, STRENGTH_TOTAL } from '../data/strength'
import {
  armyVisible,
  toggleArmy,
  armyState,
  situationVisible,
} from '../composables/useLayers'
import { playback } from '../composables/usePlayback'
import { legendCollapsed } from '../composables/usePrefs'
import { parseDate, endOfDay } from '../utils/geo'

const collapsed = legendCollapsed

function statusText(a) {
  const s = armyState[a.key]
  if (!s.started) return '待出发'
  if (s.done) return '✓ 已到达'
  return `行军中 ${s.pct}%`
}

// 当前时间点上各态势层活跃实体数（与地图显隐同用 endOfDay 语义，保证计数一致）
const counts = computed(() => {
  const t = playback.time
  const active = (x) => parseDate(x.from) <= t && t <= endOfDay(x.to)
  return {
    zones: ZONES.filter(active).length,
    kmt: [...KMT_BLOCKADES, ...KMT_UNITS].filter(active).length,
    japan: JAPAN_CRISES.filter(active).length,
    stories: STORIES.filter(active).length,
    rivers: RIVERS.length, // 静态地理层，无时间窗
  }
})

const SITUATION_ITEMS = [
  {
    key: 'zones',
    name: '红军根据地驻扎',
    sub: '六大苏区存续演变',
    color: '#c62828',
    tip: '红军各根据地的时间窗显示：出发即失去、会师即获得',
  },
  {
    key: 'kmt',
    name: '国民党军围堵',
    sub: '封锁线 · 追剿 · 驻防',
    color: '#546e7a',
    tip: '四道封锁线与湘、粤、桂、黔、川、滇、中央军、东北军部署',
  },
  {
    key: 'japan',
    name: '日军威胁',
    sub: '民族危机 · 北上抗日',
    color: '#8e2020',
    tip: '九一八、华北事变、绥远抗战——长征"北上抗日"的时代背景',
  },
  {
    key: 'stories',
    name: '精神印记',
    sub: '半条被子 · 金色鱼钩 · 丰碑',
    color: '#d4a94e',
    tip: '长征路上体现不怕牺牲、患难与共、鱼水情深的故事，点击地图书签阅读',
  },
  {
    key: 'rivers',
    name: '江河要津',
    sub: '湘江 · 乌江 · 赤水 · 金沙江 · 大渡河',
    color: '#2f7fbf',
    tip: '长征渡过的十条大江大河（简化示意走线）——一条大河就是一道雄关',
  },
]

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
    <h4 class="lg-head" title="点击折叠/展开图例" @click="collapsed = !collapsed">
      红军部队
      <span class="lg-fold">{{ collapsed ? '▸' : '▾' }}</span>
    </h4>
    <div v-show="!collapsed">
    <button
      v-for="a in ARMIES"
      :key="a.key"
      class="army-item"
      :class="{ off: !armyVisible[a.key] }"
      :title="armyVisible[a.key] ? '点击隐藏该部队路线' : '点击显示该部队路线'"
      @click="toggleArmy(a.key)"
    >
      <span class="swatch" :style="{ background: a.color }"></span>
      <span class="a-info">
        <span class="a-name">{{ a.name }}</span>
        <span class="a-sub">{{ a.sub }} · {{ a.mileage }}</span>
      </span>
      <span class="a-status">{{ statusText(a) }}</span>
    </button>

    <h4 class="lg-sec">红军兵力</h4>
    <div class="str-box">
      <div class="str-total">
        <span class="str-num">{{ strengths.totalText }}</span>
        <span class="str-sub">出发 {{ STRENGTH_TOTAL.start }} → 到达 {{ STRENGTH_TOTAL.end }}</span>
      </div>
      <div v-for="r in strengths.rows" :key="r.army.key" class="str-row">
        <span class="str-name" :style="{ color: r.army.color }">{{ r.army.short }}</span>
        <div class="str-bar">
          <i :style="{ width: r.pct + '%', background: r.army.color }"></i>
        </div>
        <span class="str-n">{{ strengthText(r.n) }}</span>
      </div>
    </div>

    <h4 class="lg-sec">战场态势</h4>
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
      <span class="a-status">{{ counts[s.key] }} 处</span>
    </button>

    <h4 class="lg-sec">显示设置</h4>
    <div class="mode-seg" title="事件图标的展示方式">
      <button :class="{ on: playback.markerMode === 'march' }" @click="playback.markerMode = 'march'">
        随行军浮现
      </button>
      <button :class="{ on: playback.markerMode === 'all' }" @click="playback.markerMode = 'all'">
        全部常显
      </button>
    </div>
    <div class="mode-note">
      {{ playback.markerMode === 'march' ? '行军中隐藏未抵达的图标，小红军走过即浮现' : '全部图标常显，未发生的淡化展示' }}
    </div>
    </div>
  </div>
</template>
