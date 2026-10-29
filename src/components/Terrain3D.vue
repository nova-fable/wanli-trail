<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ARMIES, STRENGTH_TOTAL, strengthAt, strengthText } from '../mock'
import { armyVisible, situationVisible } from '../composables/useLayers'
import { BASEMAPS } from '../composables/useMapBase'
import { halt, openEvent, play, playback, seek, toggle } from '../composables/usePlayback'
import { MARKER_MODE } from '../core/enums'
import { useI18n } from '../core/i18n'
import { parseDate, formatCnDate } from '../utils/geo'
import { createTerrain3D, TERRAIN3D_SCENES } from '../map/terrain3d'
import ArmyInsetMap from './ArmyInsetMap.vue'
import EventPanel from './EventPanel.vue'

const { t } = useI18n()
const emit = defineEmits(['close'])
const mapEl = ref(null)
const mainLabelEl = ref(null)
const activeScene = ref(null)
const toolsOpen = ref(window.innerWidth > 768)
const selectedArmy = ref('first')
const mainArmy = computed(() => ARMIES.find((army) => army.key === selectedArmy.value))
const insetArmies = computed(() => ARMIES.filter((army) => army.key !== selectedArmy.value))
const armyProgress = reactive(
  Object.fromEntries(ARMIES.map((army) => [army.key, { started: false, done: false, pct: 0 }])),
)
const strengthRows = computed(() =>
  ARMIES.map((army) => ({ army, count: strengthAt(army.key, playback.time) })),
)
const strengthTotal = computed(() => {
  const total = strengthRows.value.reduce((sum, row) => sum + (row.count || 0), 0)
  return total > 0 ? strengthText(total) : '—'
})
const basemapAttribution = computed(
  () => BASEMAPS.find((item) => item.key === playback.basemap)?.attribution || BASEMAPS[0].attribution,
)

let terrainMap = null
let disposed = false

function updateMap(force = false) {
  terrainMap?.update(playback.time, {
    force,
    playing: playback.playing,
    follow: playback.follow,
    selectedArmy: selectedArmy.value,
    panelEvent: playback.panelEvent,
    markerMode: playback.markerMode,
    armyVisible,
    situationVisible,
  })
}

function onProgress(key, status) {
  const current = armyProgress[key]
  if (current.started !== status.started) current.started = status.started
  if (current.done !== status.done) current.done = status.done
  if (current.pct !== status.pct) current.pct = status.pct
}

function statusText(army) {
  const status = armyProgress[army.key]
  if (!status.started) return t('legend.status.idle')
  if (status.done) return t('legend.status.done')
  return t('legend.status.marching', { pct: status.pct })
}

function selectScene(scene) {
  activeScene.value = scene.key
  playback.follow = false
  terrainMap?.flyToScene(scene.key)
}

function selectArmy(army) {
  armyVisible[army.key] = true
  selectedArmy.value = army.key
  activeScene.value = null
  playback.follow = true
  nextTick(() => mainLabelEl.value?.focus({ preventScroll: true }))
}

function showLecture(event) {
  halt()
  seek(parseDate(event.date))
  openEvent(event)
  terrainMap?.closePopup()
}

function playFromEvent(event) {
  halt()
  playback.follow = true
  seek(parseDate(event.date))
  terrainMap?.closePopup()
  play()
}

onMounted(async () => {
  playback.follow = true
  await nextTick()
  const { preparedRoutes } = await import('../composables/useRoutes')
  if (disposed || !mapEl.value) return
  terrainMap = createTerrain3D(mapEl.value, {
    routes: preparedRoutes,
    basemaps: BASEMAPS,
    basemap: playback.basemap,
    t,
    onReady: () => {
      updateMap(true)
    },
    onUserMove: () => {
      if (playback.follow) {
        playback.follow = false
        updateMap(true)
      }
    },
    onEventLecture: showLecture,
    onEventPlay: playFromEvent,
    onProgress,
  })
})

watch(
  () => [
    playback.time,
    playback.playing,
    playback.follow,
    selectedArmy.value,
    playback.markerMode,
    playback.panelEvent?.id,
  ],
  () => updateMap(!playback.playing),
)
watch(
  () => playback.basemap,
  (key) => terrainMap?.setBasemap(key),
)
watch(armyVisible, () => updateMap(true), { deep: true })
watch(situationVisible, () => updateMap(true), { deep: true })
watch(() => playback.follow, (follow) => {
  if (follow) activeScene.value = null
})
onBeforeUnmount(() => {
  disposed = true
  terrainMap?.destroy()
  terrainMap = null
})
</script>

<template>
  <section class="terrain3d" :aria-label="t('terrain3d.title')">
    <div ref="mapEl" class="terrain3d-map"></div>
    <div ref="mainLabelEl" class="terrain3d-main-label" tabindex="-1">
      {{ t('terrain3d.mainView', { army: mainArmy.name }) }} ·
      {{ armyVisible[mainArmy.key] ? statusText(mainArmy) : t('terrain3d.hidden') }}
      <template v-if="!playback.follow"> · {{ t('terrain3d.freeCamera') }}</template>
    </div>
    <div class="terrain3d-compact-controls" v-if="!toolsOpen">
      <button @click="toolsOpen = true">{{ t('terrain3d.settings') }}</button>
      <button :aria-label="t('close')" @click="emit('close')">×</button>
    </div>
    <div v-show="toolsOpen" class="terrain3d-tools">
      <div class="terrain3d-head">
        <div>
          <h2>{{ t('terrain3d.title') }}</h2>
          <p>{{ t('terrain3d.note') }}</p>
        </div>
        <button class="terrain3d-close" :aria-label="t('terrain3d.collapse')" @click="toolsOpen = false">−</button>
        <button class="terrain3d-close" :aria-label="t('close')" @click="emit('close')">×</button>
      </div>

      <div class="terrain3d-time">
        <strong>{{ formatCnDate(playback.time) }}</strong>
        <button :title="playback.playing ? t('tip.pause') : t('tip.play')" @click="toggle">
          {{ playback.playing ? '❚❚' : '▶' }}
        </button>
      </div>

      <div class="terrain3d-scenes">
        <button
          v-for="scene in TERRAIN3D_SCENES"
          :key="scene.key"
          :class="{ on: activeScene === scene.key }"
          @click="selectScene(scene)"
        >
          {{ t(`terrain3d.scene.${scene.key}`) }}
        </button>
      </div>
      <p class="terrain3d-caption">
        {{ activeScene ? t(`terrain3d.caption.${activeScene}`) : t(playback.follow ? 'terrain3d.caption.follow' : 'terrain3d.caption.manual') }}
      </p>

      <section class="terrain3d-section">
        <h3>{{ t('terrain3d.routeLayers') }}</h3>
        <button
          v-for="army in ARMIES"
          :key="army.key"
          class="terrain3d-layer"
          :class="{ off: !armyVisible[army.key] }"
          @click="armyVisible[army.key] = !armyVisible[army.key]"
        >
          <i :style="{ background: army.color }"></i>
          <span>{{ army.short }}</span>
          <small>{{ statusText(army) }}</small>
        </button>
        <div class="terrain3d-strength">
          <div class="terrain3d-strength-total">
            <strong>{{ strengthTotal }}</strong>
            <small>{{ t('legend.strengthRange', { from: STRENGTH_TOTAL.start, to: STRENGTH_TOTAL.end }) }}</small>
          </div>
          <div v-for="row in strengthRows" :key="row.army.key" class="terrain3d-strength-row">
            <b :style="{ color: row.army.color }">{{ row.army.short }}</b>
            <span>{{ row.count == null ? '—' : strengthText(row.count) }}</span>
          </div>
        </div>
      </section>

      <section class="terrain3d-section">
        <h3>{{ t('legend.display') }}</h3>
        <div class="terrain3d-modes">
          <button
            :class="{ on: playback.markerMode === MARKER_MODE.MARCH }"
            @click="playback.markerMode = MARKER_MODE.MARCH"
          >
            {{ t('legend.mode.march') }}
          </button>
          <button
            :class="{ on: playback.markerMode === MARKER_MODE.ALL }"
            @click="playback.markerMode = MARKER_MODE.ALL"
          >
            {{ t('legend.mode.all') }}
          </button>
        </div>
      </section>

      <section class="terrain3d-section">
        <h3>{{ t('terrain3d.situationLayers') }}</h3>
        <div class="terrain3d-situation">
          <button
            v-for="layer in ['zones', 'kmt', 'japan', 'stories', 'rivers']"
            :key="layer"
            :class="{ off: !situationVisible[layer] }"
            @click="situationVisible[layer] = !situationVisible[layer]"
          >
            {{ t(`legend.item.${layer}.name`) }}
          </button>
        </div>
      </section>
    </div>
    <div class="army-insets" :aria-label="t('terrain3d.parallel')">
      <ArmyInsetMap
        v-for="army in insetArmies"
        :key="army.key"
        :army="army"
        :status="statusText(army)"
        :visible="armyVisible[army.key]"
        @select="selectArmy(army)"
      />
    </div>
    <EventPanel />
    <div class="terrain3d-attribution">{{ t('terrain3d.source', { basemap: basemapAttribution }) }}</div>
  </section>
</template>
