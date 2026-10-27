<!--
  @file 人物志面板：22 位关键人物清单
  职责：点击人物 → 暂停播放并打开其 firstEvent 讲解（镜头随之飞往）。
  骨架（根容器/标题栏/关闭按钮）复用 OverlayShell。
-->
<script setup>
import { FIGURES, figureColor, EVENTS } from '../mock'
import { playback, openEvent } from '../composables/usePlayback'
import { useI18n } from '../core/i18n'
import OverlayShell from './OverlayShell.vue'

const { t } = useI18n()

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
  <OverlayShell base-class="figures-panel" :title="t('fp.title')" @close="emit('close')">
    <div class="fp-list">
      <button
        v-for="f in FIGURES"
        :key="f.id"
        class="fp-item"
        :title="t('fp.itemTip', { name: f.name })"
        @click="jump(f)"
      >
        <span class="fp-avatar" :style="{ background: figureColor(f) }">{{ f.name[0] }}</span>
        <div class="fp-info">
          <div class="fp-name">{{ f.name }}<span class="fp-role">{{ f.role }}</span></div>
          <div class="fp-desc">{{ f.desc }}</div>
        </div>
      </button>
    </div>
  </OverlayShell>
</template>
