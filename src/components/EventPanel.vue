<script setup>
import { computed } from 'vue'
import { playback, closePanel, play, openEvent, seek } from '../composables/usePlayback'
import { EVENTS, EVENT_TYPES, DEPARTURE_DATE } from '../data/events'
import { ARMIES } from '../data/armies'
import { parseDate, DAY_MS } from '../utils/geo'

const ev = computed(() => playback.panelEvent)
const typeMeta = computed(() => (ev.value ? EVENT_TYPES[ev.value.type] : null))
const idx = computed(() => (ev.value ? EVENTS.findIndex((e) => e.id === ev.value.id) : -1))

const dayText = computed(() => {
  if (!ev.value) return ''
  const n = Math.floor((parseDate(ev.value.date) - parseDate(DEPARTURE_DATE)) / DAY_MS) + 1
  return n > 0 ? `长征第 ${n} 天` : '长征前夕'
})

const armyChip = computed(() => {
  if (!ev.value) return null
  if (ev.value.army === 'all') return { name: '多路红军主力', color: '#d4a94e' }
  const a = ARMIES.find((x) => x.key === ev.value.army)
  return a ? { name: a.name, color: a.color } : null
})

const showContinue = computed(() => !!playback.currentEvent)
// 手动打开的事件（含播放已结束的场合）：始终允许"跳到该事件继续"
const showPlayFromHere = computed(() => !playback.currentEvent && !playback.playing)

function go(delta) {
  const i = idx.value + delta
  if (i >= 0 && i < EVENTS.length) openEvent(EVENTS[i])
}

// 手动打开的事件（过去/未来）：先跳到该事件日期再播放，镜头随后平滑飞往部队
function continueFromEvent() {
  if (ev.value) seek(parseDate(ev.value.date))
  play()
}
</script>

<template>
  <div v-if="ev" :key="ev.id" class="event-panel">
    <div class="ep-top">
      <span class="ep-type" :style="{ background: typeMeta.color }">
        {{ typeMeta.mark }} {{ typeMeta.label }}
      </span>
      <button class="ep-close" title="关闭" @click="closePanel">✕</button>
    </div>

    <h3 class="ep-name">{{ ev.name }}</h3>

    <div class="ep-meta">
      <span><i class="ep-k">时</i><b>{{ ev.dateLabel }}</b></span>
      <span v-if="dayText" class="ep-day"><i class="ep-k">程</i>{{ dayText }}</span>
      <span><i class="ep-k">地</i>{{ ev.place }}</span>
      <span v-if="armyChip" class="ep-army">
        <i class="dot" :style="{ background: armyChip.color }"></i>{{ armyChip.name }}
      </span>
    </div>

    <div v-if="ev.people && ev.people.length" class="ep-people">
      <span v-for="p in ev.people" :key="p" class="ep-person" :title="`${p} · 相关人物`">
        <i>{{ p[0] }}</i>{{ p }}
      </span>
    </div>

    <p class="ep-desc">{{ ev.desc }}</p>

    <div v-if="showContinue || showPlayFromHere" class="ep-actions">
      <button v-if="showContinue" class="btn-primary" @click="play()">继续前进 ▸▸</button>
      <button v-else class="btn-primary" @click="continueFromEvent">▶ 从此处继续</button>
    </div>

    <div class="ep-nav">
      <button :disabled="idx <= 0" @click="go(-1)">◂ 上一事件</button>
      <span class="pos">{{ idx + 1 }} / {{ EVENTS.length }}</span>
      <button :disabled="idx >= EVENTS.length - 1" @click="go(1)">下一事件 ▸</button>
    </div>
  </div>
</template>
