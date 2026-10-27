<!--
  @file 事件总览索引面板：57 个事件的可筛选清单
  职责：按部队筛选、已发生着色、当前项高亮；点击条目 → seek 到该日期并讲解。
  数据来源：EVENTS + playback.time（着色与"当前项"判定）。
  骨架（根容器/标题栏/关闭按钮）复用 OverlayShell。
  ⚠️ 原实现用 `shifted: !!playback.panelEvent`：面板与讲解卡同占右侧，讲解卡打开时需左移。
-->
<script setup>
import { computed, ref } from 'vue'
import { EVENTS, EVENT_TYPES, ARMIES, eventMeta, eventIndexOf } from '../mock'
import { playback, openEvent, seek } from '../composables/usePlayback'
import { parseDate } from '../utils/geo'
import { useI18n } from '../core/i18n'
import OverlayShell from './OverlayShell.vue'

const { t } = useI18n()

const emit = defineEmits(['close'])

const FILTERS = [
  { key: 'all', name: t('ei.filter.all') },
  ...ARMIES.map((a) => ({ key: a.key, name: a.short, color: a.color })),
]
const filter = ref('all')

// 已发生/未发生随播放推进着色；"当前项"= 播放头所在的前一个事件
const rows = computed(() => {
  const t = playback.time
  const f = filter.value
  // EVENTS 已按日期升序（mock/events 装配保证）：逆序找第一个未发生的，其前一位即当前项
  let nextIdx = EVENTS.length
  while (nextIdx > 0 && !(parseDate(EVENTS[nextIdx - 1].date) <= t)) nextIdx--
  const currentId = nextIdx > 0 ? EVENTS[nextIdx - 1].id : null
  return EVENTS.filter((ev) => f === 'all' || ev.army === f).map((ev) => ({
    ev,
    past: parseDate(ev.date) <= t,
    current: ev.id === currentId,
    // 序号在此一次性取（eventMeta 内部走 EVENTS.indexOf，每行 O(n)）；
    // 若放到模板里逐行调用则是渲染期 O(n²)，见文件头注释
    meta: eventMeta(ev),
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
  <OverlayShell base-class="event-index" :title="t('ei.title')" @close="emit('close')">
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
        :title="t('ei.itemTip', { name: r.ev.name })"
        @click="jump(r.ev)"
      >
        <span class="ei-dot" :style="{ background: r.meta.typeMeta.color }"></span>
        <span class="ei-idx">{{ r.meta.order }}</span>
        <span class="ei-name">{{ r.ev.name }}</span>
        <span class="ei-date">{{ r.ev.dateLabel }}</span>
      </button>
    </div>
  </OverlayShell>
</template>
