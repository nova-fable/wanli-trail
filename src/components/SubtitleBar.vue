<!--
  @file 字幕条：阶段叙述 + 诗词金句（第二声道）
  数据来源：phases.js / quotes.js（时间窗 find，endOfDay 语义）。
-->
<script setup>
import { computed } from 'vue'
import { playback } from '../composables/usePlayback'
import { PHASES, QUOTES } from '../mock'
import { parseDate, endOfDay } from '../utils/geo'

// 日期字符串按"当天之内"理解（endOfDay 统一语义，见 utils/geo.js）
const PARSED = PHASES.map((p) => ({ ...p, fromT: parseDate(p.from), toT: endOfDay(p.to) }))
const QUOTES_PARSED = QUOTES.map((q) => ({ ...q, fromT: parseDate(q.from), toT: endOfDay(q.to) }))

const text = computed(() => {
  const t = playback.time
  const ph = PARSED.find((p) => t >= p.fromT && t <= p.toT)
  return ph ? ph.text : ''
})

// 长征诗词：在特定时段以金色小字浮现于字幕上方
const quote = computed(() => {
  const t = playback.time
  const q = QUOTES_PARSED.find((p) => t >= p.fromT && t <= p.toT)
  return q ? q : null
})
</script>

<template>
  <div class="subtitle-bar">
    <div class="subtitle-stack">
      <div v-if="quote" class="subtitle-quote">
        {{ quote.text }}<span class="q-note">—— {{ quote.note }}</span>
      </div>
      <div class="subtitle-text">{{ text }}</div>
    </div>
  </div>
</template>
