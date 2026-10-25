<script setup>
import { ARMIES } from '../data/armies'
import { EVENTS } from '../data/events'
import { startTour, startExplore } from '../composables/usePlayback'
</script>

<template>
  <div class="intro-overlay">
    <div class="intro-star">★</div>
    <h1 class="intro-title">红军长征</h1>
    <div class="intro-sub">伟大的战略转移 · 1934.10 — 1936.10</div>

    <div class="intro-armies">
      <span v-for="a in ARMIES" :key="a.key">
        <i :style="{ background: a.color }"></i>{{ a.name }}
      </span>
    </div>

    <div class="intro-actions">
      <button class="btn-tour" @click="startTour">▶ 开始演示</button>
      <button class="btn-explore" @click="startExplore">自由探索</button>
    </div>

    <div class="intro-tips">
      <span>播放沿史实推进，跨过关键事件自动暂停讲解、镜头推近</span>
      <span>镜头默认跟随部队行军，拖动地图即可随时接管视角</span>
      <span>空格 播放/暂停 · ← → 前后七天 · Esc 关闭浮层</span>
    </div>

    <div class="intro-note">
      四路红军 · {{ EVENTS.length }} 个关键事件 · 坐标为近似考证值，仅供演示
    </div>
  </div>
</template>
