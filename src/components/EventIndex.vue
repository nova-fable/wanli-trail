<script setup>
import { computed, ref } from 'vue'
import { EVENTS, EVENT_TYPES } from '../data/events'
import { ARMIES } from '../data/armies'
import { playback, openEvent, seek } from '../composables/usePlayback'
import { parseDate } from '../utils/geo'

const emit = defineEmits(['close'])

const FILTERS = [
  { key: 'all', name: '全部' },
  ...ARMIES.map((a) => ({ key: a.key, name: a.short, color: a.color })),
]
const filter = ref('all')

// 已发生/未发生随播放推进着色；"当前项"= 播放头所在的前一个事件
const rows = computed(() => {
  const t = playback.time
  const f = filter.value
  let currentId = null
  for (const ev of EVENTS) {
    if (parseDate(ev.date) <= t) currentId = ev.id
    else break
  }
  return EVENTS.filter((ev) => f === 'all' || ev.army === f).map((ev) => ({
    ev,
    past: parseDate(ev.date) <= t,
    current: ev.id === currentId,
  }))
})

// 点击条目 → 跳到该事件日期并弹出讲解（暂停播放、镜头飞行）
function jump(ev) {
  playback.playing = false
  playback.follow = false
  seek(parseDate(ev.date))
  openEvent(ev)
}
</script>

<template>
  <div class="event-index" :class="{ shifted: !!playback.panelEvent }">
    <div class="fp-head">
      <h4>❖ 事件总览</h4>
      <button class="ep-close" title="关闭" @click="emit('close')">✕</button>
    </div>
    <div class="ei-filters">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        :class="{ on: filter === f.key }"
        @click="filter = f.key"
      >
        {{ f.name }}
      </button>
    </div>
    <div class="ei-list">
      <button
        v-for="r in rows"
        :key="r.ev.id"
        class="ei-item"
        :class="{ future: !r.past, now: r.current }"
        :title="`点击跳转：${r.ev.name}`"
        @click="jump(r.ev)"
      >
        <span class="ei-dot" :style="{ background: EVENT_TYPES[r.ev.type].color }"></span>
        <span class="ei-idx">{{ EVENTS.indexOf(r.ev) + 1 }}</span>
        <span class="ei-name">{{ r.ev.name }}</span>
        <span class="ei-date">{{ r.ev.dateLabel }}</span>
      </button>
    </div>
  </div>
</template>
