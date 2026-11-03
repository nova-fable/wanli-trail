<!--
  @file 天气氛围层：屏幕雨雪风粒子（纯 CSS 动画，mock 天气节点时间窗驱动）
-->
<script setup>
import { computed } from 'vue'
import { useWeather } from '../composables/useWeather'

// kind → 粒子形态：heat 不落粒子（干热由季节色调承担）
const FX_BY_KIND = { snow: 'snow', rain: 'rain', cold: 'wind', frost: 'wind', heat: null }

const { weatherNode } = useWeather()
const fx = computed(() => (weatherNode.value ? FX_BY_KIND[weatherNode.value.kind] : null))

// 粒子种子创建时定型，动画全走 CSS keyframes（无逐帧 JS；遮挡环境不依赖 rAF）
const flakes = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 53) % 100,
  delay: ((i * 0.37) % 3).toFixed(2),
  dur: 4 + (i % 5),
  size: 3 + (i % 3),
  drift: ((i * 17) % 40) - 20,
}))

const drops = Array.from({ length: 84 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 0.29) % 1.6).toFixed(2),
  dur: (0.8 + (i % 5) * 0.14).toFixed(2),
  len: 16 + (i % 4) * 8,
  drift: -16 - (i % 4) * 8,
  opacity: (0.35 + (i % 4) * 0.13).toFixed(2),
}))

const gusts = Array.from({ length: 24 }, (_, i) => ({
  top: 6 + ((i * 61) % 82),
  width: 110 + (i % 5) * 55,
  delay: ((i * 0.53) % 3).toFixed(2),
  dur: (2.2 + (i % 4) * 0.8).toFixed(2),
}))

const fogs = Array.from({ length: 4 }, (_, i) => ({
  left: 6 + i * 24,
  delay: i * 2.2,
  dur: 16 + i * 4,
}))
</script>

<template>
  <div v-if="fx" class="fx-layer" :class="`fx-${fx}`">
    <div class="fx-tint" :class="fx === 'rain' ? 'fx-grassy' : 'fx-cold'"></div>
    <template v-if="fx === 'snow'">
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
    <template v-else-if="fx === 'rain'">
      <span
        v-for="(d, i) in drops"
        :key="'r' + i"
        class="fx-drop"
        :style="{
          left: d.left + '%',
          animationDelay: d.delay + 's',
          animationDuration: d.dur + 's',
          height: d.len + 'px',
          opacity: d.opacity,
          '--drift': d.drift + 'px',
        }"
      ></span>
      <span
        v-for="(g, i) in fogs"
        :key="'f' + i"
        class="fx-fog"
        :style="{ left: g.left + '%', animationDelay: g.delay + 's', animationDuration: g.dur + 's' }"
      ></span>
    </template>
    <template v-else>
      <span
        v-for="(g, i) in gusts"
        :key="'w' + i"
        class="fx-gust"
        :style="{
          top: g.top + '%',
          width: g.width + 'px',
          animationDelay: g.delay + 's',
          animationDuration: g.dur + 's',
        }"
      ></span>
    </template>
  </div>
</template>
