<script setup>
import { FIGURES, figureColor } from '../data/figures'
import { EVENTS } from '../data/events'
import { playback, openEvent } from '../composables/usePlayback'

const emit = defineEmits(['close'])

// 点击人物 → 跳到该人物的首次登场事件（暂停播放、镜头飞往）
function jump(f) {
  const ev = EVENTS.find((e) => e.id === f.firstEvent)
  if (ev) {
    playback.playing = false
    playback.follow = false
    openEvent(ev)
  }
}
</script>

<template>
  <div class="figures-panel" :class="{ shifted: !!playback.panelEvent }">
    <div class="fp-head">
      <h4>长征人物志</h4>
      <button class="ep-close" title="关闭" @click="emit('close')">✕</button>
    </div>
    <div class="fp-list">
      <button
        v-for="f in FIGURES"
        :key="f.id"
        class="fp-item"
        :title="`点击查看：${f.name}首次登场的事件`"
        @click="jump(f)"
      >
        <span class="fp-avatar" :style="{ background: figureColor(f) }">{{ f.name[0] }}</span>
        <div class="fp-info">
          <div class="fp-name">{{ f.name }}<span class="fp-role">{{ f.role }}</span></div>
          <div class="fp-desc">{{ f.desc }}</div>
        </div>
      </button>
    </div>
  </div>
</template>
