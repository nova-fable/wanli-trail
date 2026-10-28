<!--
  @file 事件讲解卡：自动暂停或手动点击时的单事件详情
  职责：类型徽记/时间地点人物/讲解词/继续前进（跳转到该事件日期再播放）/上下翻页。
  数据来源：playback.panelEvent + EVENTS 检索。
-->
<script setup>
import { computed } from 'vue'
import { playback, closePanel, play, openEvent, seek } from '../composables/usePlayback'
import { EVENTS, EVENT_TYPES, DEPARTURE_DATE, ARMIES, eventMeta, eventIndexOf } from '../mock'
import { parseDate } from '../utils/geo'
import { dayOfMarch } from '../utils/date'
import { armyColor, armyName } from '../utils/format'
import { useI18n } from '../core/i18n'

const { t } = useI18n()

// 多路红军主力（army === 'all'）不是 ARMIES 成员，用固定中性金
const ALL_ARMIES_COLOR = '#d4a94e'

const ev = computed(() => playback.panelEvent)
// 类型徽记：eventMeta 收敛了“类型元数据 + 缺失类型兜底 battle”的口径
const typeMeta = computed(() => (ev.value ? eventMeta(ev.value).typeMeta : null))
// 序号用 eventIndexOf（1 基，非成员返回 null）：与时间轴/索引面板同源
const order = computed(() => (ev.value ? eventIndexOf(ev.value) : null))

const dayText = computed(() => {
  if (!ev.value) return ''
  const n = dayOfMarch(ev.value.date, DEPARTURE_DATE)
  return n > 0 ? t('ep.day', { n }) : t('ep.day.pre')
})

const armyChip = computed(() => {
  if (!ev.value) return null
  if (ev.value.army === 'all') return { name: t('ep.allArmies'), color: ALL_ARMIES_COLOR }
  const color = armyColor(ARMIES, ev.value.army)
  return color ? { name: armyName(ARMIES, ev.value.army), color } : null
})

const showContinue = computed(() => !!playback.currentEvent)
// 手动打开的事件（含播放已结束的场合）：始终允许"跳到该事件继续"
const showPlayFromHere = computed(() => !playback.currentEvent && !playback.playing)

function go(delta) {
  const i = (order.value ?? 0) - 1 + delta
  if (i >= 0 && i < EVENTS.length) openEvent(EVENTS[i])
}

// 手动打开的事件（过去/未来）：先跳到该事件日期再播放，镜头随后平滑飞往部队
function continueFromEvent() {
  if (ev.value) seek(parseDate(ev.value.date))
  play()
}
</script>

<template>
  <!-- 不加 :key：相邻事件切换原地更新内容；v-if 只在面板开/关时挂载（入场动画仅此一次），
       避免 :key 重建导致的整卡 slide-in 重放闪烁 -->
  <div v-if="ev" class="event-panel">
    <div class="ep-top">
      <span class="ep-type" :style="{ background: typeMeta.color }">
        {{ typeMeta.mark }} {{ typeMeta.label }}
      </span>
      <button class="ep-close" :title="t('ep.close')" @click="closePanel">✕</button>
    </div>

    <h3 class="ep-name">{{ ev.name }}</h3>

    <div class="ep-meta">
      <span><i class="ep-k">{{ t('ep.k.date') }}</i><b>{{ ev.dateLabel }}</b></span>
      <span v-if="dayText" class="ep-day"><i class="ep-k">{{ t('ep.k.day') }}</i>{{ dayText }}</span>
      <span><i class="ep-k">{{ t('ep.k.place') }}</i>{{ ev.place }}</span>
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
      <button v-if="showContinue" class="btn-primary" @click="play()">{{ t('ep.continue') }}</button>
      <button v-else class="btn-primary" @click="continueFromEvent">{{ t('ep.playFrom') }}</button>
    </div>

    <div class="ep-nav">
      <button :disabled="order <= 1" @click="go(-1)">{{ t('ep.prev') }}</button>
      <span class="pos">{{ order }} / {{ EVENTS.length }}</span>
      <button :disabled="order >= EVENTS.length" @click="go(1)">{{ t('ep.next') }}</button>
    </div>
  </div>
</template>
