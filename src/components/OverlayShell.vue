<!--
  @file 右侧浮层通用骨架：面板根 + 标题栏 + 关闭按钮
  职责：统一「根容器（含 shifted 让位）/ 标题 h4 / 关闭按钮」这三段结构，
  内容由默认插槽提供。EventIndex 与 FiguresPanel 共用本骨架。

  ⚠️ 类名是样式契约：baseClass 必须是 .event-index / .figures-panel 之一，
  标题栏固定 .fp-head、关闭按钮固定 .ep-close —— panel-index.css 与 responsive.css
  按这些字面类名选择（含 `.fp-head .ep-close { margin-left: auto }`），改名即丢规则。

  shifted 读 playback 单例：让位判定全站只有「讲解卡是否打开」一个来源
  （usePlayback 的 panelEvent），由 shell 内聚可避免每个调用方各写一遍
  `:class="{ shifted: !!playback.panelEvent }"`。
-->
<script setup>
import { playback } from '../composables/usePlayback'
import { useI18n } from '../core/i18n'

const { t } = useI18n()

defineProps({
  /** 面板根类名：'event-index' | 'figures-panel'（必须在 panel-index.css 中存在） */
  baseClass: { type: String, required: true },
  /** 标题栏文案（已键化的 UI chrome） */
  title: { type: String, required: true },
})

const emit = defineEmits(['close'])
</script>

<template>
  <div :class="[baseClass, { shifted: !!playback.panelEvent }]">
    <div class="fp-head">
      <h4>{{ title }}</h4>
      <button class="ep-close" :title="t('close')" @click="emit('close')">✕</button>
    </div>
    <slot />
  </div>
</template>
