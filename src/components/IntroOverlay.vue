<script setup>
/**
 * @file 开场页（路由页）：标题展示与两种模式入口
 *
 * 职责：整页渲染的开场画面，向 App 发出用户选择；不直接操作播放状态。
 * 数据来源：ARMIES（四路红军图例）、EVENTS（事件计数）。
 * 写路径：emit('start', mode) → App.onStart() 负责初始化播放并导航到沙盘路由。
 */
import { ARMIES } from '../data/armies'
import { EVENTS } from '../data/events'
import { useI18n } from '../core/i18n'

const { t } = useI18n()

/** start 事件：mode = 'tour'（开始演示）| 'explore'（自由探索） */
const emit = defineEmits(['start'])
</script>

<template>
  <div class="intro-overlay">
    <div class="intro-star">★</div>
    <h1 class="intro-title">红军长征</h1>
    <div class="intro-sub">{{ t('intro.sub') }}</div>

    <div class="intro-armies">
      <span v-for="a in ARMIES" :key="a.key">
        <i :style="{ background: a.color }"></i>{{ a.name }}
      </span>
    </div>

    <div class="intro-actions">
      <button class="btn-tour" @click="emit('start', 'tour')">{{ t('intro.btn.tour') }}</button>
      <button class="btn-explore" @click="emit('start', 'explore')">{{ t('intro.btn.explore') }}</button>
    </div>

    <div class="intro-tips">
      <span v-for="(tip, i) in t('intro.tips')" :key="i">{{ tip }}</span>
    </div>

    <div class="intro-note">
      {{ t('intro.note', { n: EVENTS.length }) }}
    </div>
  </div>
</template>
