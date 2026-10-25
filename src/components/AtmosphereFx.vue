<script setup>
// 雪山 / 草地 环境氛围：过雪山飘雪、过草地流雾
import { computed } from 'vue'
import { playback } from '../composables/usePlayback'
import { parseDate, endOfDay } from '../utils/geo'

const WINDOWS = [
  { kind: 'snow', from: '1935-06-07', to: '1935-06-28' }, // 中央红军翻夹金山等
  { kind: 'snow', from: '1936-04-25', to: '1936-06-20' }, // 红二方面军翻雪山
  { kind: 'grass', from: '1935-08-15', to: '1935-09-05' }, // 中央红军过草地
  { kind: 'grass', from: '1936-07-05', to: '1936-08-28' }, // 二、四方面军过草地
].map((w) => ({ ...w, fromT: parseDate(w.from), toT: endOfDay(w.to) }))

const kind = computed(() => {
  const t = playback.time
  const w = WINDOWS.find((w) => t >= w.fromT && t <= w.toT)
  return w ? w.kind : null
})

const flakes = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 53) % 100,
  delay: ((i * 0.37) % 3).toFixed(2),
  dur: 4 + (i % 5),
  size: 2 + (i % 3),
  drift: ((i * 17) % 40) - 20,
}))

const fogs = Array.from({ length: 4 }, (_, i) => ({
  left: 6 + i * 24,
  delay: i * 2.2,
  dur: 16 + i * 4,
}))
</script>

<template>
  <div v-if="kind" class="fx-layer" :class="kind">
    <div class="fx-tint" :class="kind === 'snow' ? 'fx-cold' : 'fx-grassy'"></div>
    <template v-if="kind === 'snow'">
      <span
        v-for="(f, i) in flakes"
        :key="'s' + i"
        class="fx-flake"
        :style="{
          left: f.left + '%',
          animationDelay: f.delay + 's',
          animationDuration: f.dur + 's',
          width: f.size + 'px',
          height: f.size + 'px',
          '--drift': f.drift + 'px',
        }"
      ></span>
    </template>
    <template v-else>
      <span
        v-for="(f, i) in fogs"
        :key="'g' + i"
        class="fx-fog"
        :style="{ left: f.left + '%', animationDelay: f.delay + 's', animationDuration: f.dur + 's' }"
      ></span>
    </template>
  </div>
</template>
